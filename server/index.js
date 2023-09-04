import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import getJsonFromStorage from "./context.js";
import { contextRetriever } from "./similarDocs.js";
import { getAccessToken } from "./paypal.js";
import {updateUserWordCount} from "./wordCountUpdate.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(bodyParser.json());
// Cache setup
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


app.post("/fetchOpenAI", async (req, res) => {
  try {
    const json = await req.body;
    const userId = json.userId;
    const fileName = json.fileName + ".json";
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
    await updateUserWordCount(context, userId);
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo-16k",
        messages: [
          {
            role: "system",
            content: `Here is the user question:
          Question: ${json.prompt}
        Search for relevant information in the context below and use it to answer user questions exhaustively and deeply using numbered list and thorough analysis.
        If the context does not provide relevant answer to the question, mention that PDF provided is not relevant to question and try to relate the question to the context.
  Context: ${context}
          `,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
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


    response.body.on("end", () => {
      updateUserWordCount(accumulatedContent, userId);
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




const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

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
