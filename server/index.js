import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import getJsonFromStorage from "./context.js";
import { contextRetriever } from "./similarDocs.js";

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

    // Check if fileContent is in cache
    const cacheKey = `${userId}-${fileName}`;
    let fileContent = getCache(cacheKey);

    if (!fileContent) {
      fileContent = await getJsonFromStorage(userId, fileName);
      // Cache the result for 5 hours
      setCache(cacheKey, fileContent, 5 * 60 * 60 * 1000);
    }

    const context = await contextRetriever(fileContent, json.prompt);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
        If the context does not provide relevant answer to the question, mention that PDF provided is not relevant to question and stop answering questions.
        Context: ${context}
          `,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API responded with ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("An error occurred:", error); // Log the error for debugging
    res.status(500).json({ error: "Failed to fetch data from OpenAI" });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
