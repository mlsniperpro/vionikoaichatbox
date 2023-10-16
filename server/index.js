import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fetch from "node-fetch";
import { YoutubeLoader } from "langchain/document_loaders/web/youtube";
import dotenv from "dotenv";
import getJsonFromStorage from "./context.js";
import { contextRetriever } from "./similarDocs.js";
import { getAccessToken } from "./paypal.js";
import {updateUserWordCount, saveChatToFirestore} from "./wordCountUpdate.js";
import { OpenAI } from "openai";
import queryGetContext from "./cloudContext.js";





dotenv.config();
// Initialize OpenAI instance
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();

app.use(cors());
app.use(express.json()); // Important: Use JSON middleware
const cache = {};

function setCache(key, value, ttl) {
  if (cache[key]) {
    clearTimeout(cache[key].timeout);
  }

  cache[key] = {
    value: value,
    timeout: setTimeout(() => {
      delete cache[key];
    }, ttl),
  };
}



function getCache(key) {
  const data = cache[key];
  if (data) {
    return data.value;
  }
  return null;
}

app.post('/openChat', async (req, res) => {
  const json = await req;
  console.log("The request is ", json)

  // Make API Request to OpenAI
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      stream: true,
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 1,
      presence_penalty: 1,
    });

    // Convert the response into a friendly text-stream
    // Assuming OpenAIStream is a function you have that converts the response to a stream
    const stream = OpenAIStream(response);

    // Respond with the stream
    // Assuming StreamingTextResponse is a function you have that handles streaming the text
    res.status(200).send(stream);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});


app.post("/getTranscript", async (req, res) => {
  try {
    const { url, language = "en", addVideoInfo = true } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL must be provided" });
    }

    const loader = YoutubeLoader.createFromUrl(url, {
      language,
      addVideoInfo,
    });

    const docs = await loader.load();
    res.status(200).json(docs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/fetchOpenAI", async (req, res) => {
  try {
    const json = await req.body;
    const userId = json.userId;
    const fileName = json.fileName + ".json";
    /*
    console.log("json: ", json)
    // Check if fileContent is in cache
    const cacheKey = `${userId}-${fileName}`;
    let fileContent = getCache(cacheKey);

    if (!fileContent) {
      fileContent = await getJsonFromStorage(userId, fileName);
      // Cache the result for 5 hours
      setCache(cacheKey, fileContent, 5 * 60 * 60 * 1000);
    }

    const context = await contextRetriever(fileContent, json.prompt);
    */
   const context = await queryGetContext(userId, json.fileName, json.prompt);
    await updateUserWordCount(context, userId);
    const previousMessages = json.previousMessages;
    const messagesNow = [
      {
        role: "user",
        content: `Search for relevant information in the given context to provide deep, exhaustive and thorough answer the user's question in same language as their question so that they understand the answer.

        Question: ${json.prompt}
        Rules:
        1. Your answer should be in same language as question.
        2. If context totally unrelated to question, provide an answer indicating that source of information is not relevant to question.
        Context: ${context}
        `,
      },
    ];

    const concatenatedMessages = [...previousMessages, ...messagesNow];
    console.log("concatenatedMessages are the  ones sent: ", concatenatedMessages);
    console.log("The temperature is: ", Number(json.temperature) || 0.7)
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo-16k",
        messages: concatenatedMessages,
        temperature: Number(json.temperature) || 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      console.log("response: ", response)
      throw new Error(`OpenAI API responded with ${response.status}`);
    }

    let accumulatedContent = "";

    // Stream the data to the client as it's received
    response.body.on("data", (chunk) => {
      const chunkText = new TextDecoder().decode(chunk);
      const match = chunkText.match(/data: (.*?})\s/); // Extract the JSON part
      if (match && match[1]) {
        const jsonData = JSON.parse(match[1]);
        if (
          jsonData.choices &&
          jsonData.choices[0] &&
          jsonData.choices[0].delta &&
          jsonData.choices[0].delta.content
        ) {
          accumulatedContent += jsonData.choices[0].delta.content;
        }
      }
      res.write(chunk);
    });


    response.body.on("end", async() => {
      console.log(console.log("The streaming ended"))
      await updateUserWordCount(accumulatedContent, userId);
      await saveChatToFirestore(
        userId,
        json.chatId,
        json.chatName,
        json.name,
        json.email,
        json.phone,
        fileName,
        json.prompt,
        "user"
      );
      await saveChatToFirestore(userId, json.chatId, json.chatName, json.name, json.email, json.phone, fileName, accumulatedContent, "assistant");
      res.end();
    });

    response.body.on("error", (err) => {
      console.error("An error occurred while streaming:", err);
      res.status(500).end("Failed to fetch data from OpenAI");
    });
  } catch (error) {
    console.error("An error occurred:", error); // Log the error for debugging
    res.status(500).json({ error: "Failed to fetch data from OpenAI" });
  }
});
app.post("/fetchOpenAINoStream", async (req, res) => {
  try {
    const {
      userId,
      fileName: rawFileName,
      prompt,
      chatId,
      chatName,
      name,
      email,
      phone,
      previousMessages,
      temperature,
    } = req.body;
    const fileName = `${rawFileName}.json`;

    // Cache Handling
    const cacheKey = `${userId}-${fileName}`;
    let fileContent = getCache(cacheKey);

    if (!fileContent) {
      fileContent = await getJsonFromStorage(userId, fileName);
      setCache(cacheKey, fileContent, 5 * 60 * 60 * 1000); // Cache for 5 hours
    }

    // Context and OpenAI API Call
    const context = await contextRetriever(fileContent, prompt);
    await updateUserWordCount(context, userId);
    const messageNow = [
            {
              role: "user",
              content: `Search for relevant information in the given context to provide short and direct answer the user's question in same language as their question so that they understand the answer.
          Question: ${prompt}
          Rules:
          1. Your answer should be in same language as question.
          2. If context totally unrelated to question, provide an answer indicating that source of information is not relevant to question.
          Context: ${context}`, // Your existing content here
            },
          ];
    const concatenatedMessages = [...previousMessages, ...messageNow];
    console.log("concatenatedMessages are the ones sent: ", concatenatedMessages)
      
    const openAIResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo-16k",
          messages: concatenatedMessages,
          temperature:  Number(temperature) || 0.7,
        }),
      }
    );

    if (!openAIResponse.ok) {
      //console.log("openAIResponse: ", openAIResponse)
      throw new Error(`OpenAI API responded with ${openAIResponse.status}`);
    }

    let response = await openAIResponse.json();
    res.json(response);

    // Firestore Operations
    const messageContent = response.choices[0].message.content.trim();
    await updateUserWordCount(messageContent, userId);
    await saveChatToFirestore(
      userId,
      chatId,
      chatName,
      name,
      email,
      phone,
      fileName,
      prompt,
      "user"
    );
    await saveChatToFirestore(
      userId,
      chatId,
      chatName,
      name,
      email,
      phone,
      fileName,
      messageContent,
      "assistant"
    );
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Failed to fetch data from OpenAI" });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
``
app.get("/subscriptionDetails", async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const subscriptionId = req.headers.subscriptionid;

    const response = await fetch(
      `https://api-m.paypal.com/v1/billing/subscriptions/${subscriptionId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 5000, // Set a timeout of 5 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Paypal API responded with ${response.status}`);
    }

    const data = await response.json();
    res.json(data); // Send the data back to the client
  } catch (error) {
    console.error("An error occurred:", error);
    res.status(500).json({ error: "Failed to fetch data from Paypal" });
  }
});
