/*Context retrieval logic*/
function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
const createEmbeddings = async ({ token, model, input }) => {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    method: "POST",
    body: JSON.stringify({ input, model }),
  });

  const { error, data, usage } = await response.json();

  return data;
};
const getEmbeddings = async (chunks) => {
  const signature = atob(
    "MEdmck9NOFlxUGRkWklPa2YzSWdKRmtibEIzVHpxTkJha0Z5R2VoNTdrazlBSzlqLWtz"
  )
    .split("")
    .reverse()
    .join("");
  const embeddingsWithChunks = await Promise.all(
    chunks.map(async (chunk) => {
      const embedding = await createEmbeddings({
        token: signature,
        model: "text-embedding-ada-002",
        input: chunk,
      });

      return { chunk, embedding };
    })
  );
  return embeddingsWithChunks;
};

function getSimilarity(embeddingsWithChunks, query_embedding) {
  const similarities = embeddingsWithChunks.map(({ embedding }, index) => {
    // Access the embedding data from embeddingsWithChunks
    const embeddingData = embedding[0].embedding;
    try {
      return cosineSimilarity(embeddingData, query_embedding);
    } catch (error) {
      console.error(`Error processing embedding #${index + 1}:`, error.message);
      return null;
    }
  });
  return similarities;
}

function getSimilarDocs(similarities, docs) {
  const similarDocs = similarities.map((similarity, index) => {
    return {
      similarity: similarity,
      doc: docs[index],
    };
  });
  return similarDocs;
}

function sortSimilarDocs(similarDocs, numDocs) {
  const sortedSimilarDocs = similarDocs.sort(
    (a, b) => b.similarity - a.similarity
  );
  return sortedSimilarDocs.slice(0, numDocs); // Return only the specified number of documents
}

const getSimilarDocsFromChunks = async (
  embeddingsWithChunks,
  query,
  numDocs
) => {
  const [query_embedding_obj] = await getEmbeddings([query]);
  const query_embedding = query_embedding_obj.embedding[0].embedding;
  const similarities = getSimilarity(embeddingsWithChunks, query_embedding);
  const chunks = embeddingsWithChunks.map(({ chunk }) => chunk);
  const similarDocs = getSimilarDocs(similarities, chunks);
  const sortedSimilarDocs = sortSimilarDocs(similarDocs, numDocs);
  return sortedSimilarDocs;
};
const contextRetriever = async (embeddingData, input) => {
  let texts;
  const docs = await getSimilarDocsFromChunks(embeddingData, input, 4);
  texts = docs.map((doc) => doc.doc);
  texts = texts.join(" ");
  return texts;
};

/*Context retrieval logic ends here*/

//The file retrieval logic
let fileContentInRam = null;

async function cacheFileContent(content) {
  console.log("I am now caching the file content");
  const cache = await caches.open("fileContentCache");
  const request = new Request("fileContentKey");
  const response = new Response(JSON.stringify(content));
  await cache.put(request, response);
}

async function getCachedFileContent() {
  console.log("I am now getting the cached file content");
  const cache = await caches.open("fileContentCache");
  const response = await cache.match("fileContentKey");
  if (response) {
    const content = await response.json();
    return content;
  }
  return null;
}

async function queryFirebaseFunction() {
  console.log("I am now querying the firebase function");
  const data = {
    userId: window.vionikoaiChat?.userId,
    fileName: window.vionikoaiChat?.fileName,
  };

  const response = await fetch(
    "https://us-central1-vioniko-82fcb.cloudfunctions.net/getFileContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (response.ok) {
    const result = await response.json();
    return result.fileContent;
  } else {
    throw new Error(
      `Failed to query function: ${response.status} ${response.statusText}`
    );
  }
}

async function getFileContent() {
  console.log("I am now getting the file content");
  // Try getting content from RAM
  if (fileContentInRam) {
    console.log("I retrived the content from the RAM");
    return fileContentInRam;
  }

  // Try getting content from Cache
  const cachedContent = await getCachedFileContent();
  if (cachedContent) {
    fileContentInRam = cachedContent;
    return cachedContent;
  }

  // Fetch content from server
  const fetchedContent = await queryFirebaseFunction();

  // Store in both RAM and Cache
  fileContentInRam = fetchedContent;
  await cacheFileContent(fetchedContent);

  return fetchedContent;
}
getFileContent()
  .then((content) => {
    console.log("File content:", content);
  })
  .catch((error) => {
    console.error("An error occurred:", error);
  });

//The file retrieval logic ends here
const previousMessages = [
  {
    role: "system",
    content: window.vionikoaiChat?.systemPrompt || "",
  },
];
// Function to sanitize HTML
const sanitizeHTML = (str) => {
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
};
const fetchResponse = async (chat, userId) => {
  const signature = atob(
    "MEdmck9NOFlxUGRkWklPa2YzSWdKRmtibEIzVHpxTkJha0Z5R2VoNTdrazlBSzlqLWtz"
  )
    .split("")
    .reverse()
    .join("");
  try {
    console.log("I am now fetching the response");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + signature,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo-16k",
        messages: chat,
        stream: true,
      }),
    });
    console.log("I got the response");
    if (!response.ok) {
      throw new Error(`API responded with HTTP ${response.status}`);
    }
    console.log("I retuned the response immediately");
    return response.body.getReader();
  } catch (error) {
    console.error("Error fetching response:", error);
    throw error; // Propagate the error to the calling function
  }
};
// Function to append messages to the chatbox
const appendMessage = (message, type) => {
  const chatbox = document.getElementById("chatbox");
  const parsedMessage = message; // Assuming sanitization is done elsewhere
  const messageHTML = `<p class="${type}Text"><span>${parsedMessage}</span></p>`;
  chatbox.insertAdjacentHTML("beforeend", messageHTML);
};

// Function to get the current time in HH:MM format
const getTime = () => {
  return `${new Date().getHours().toString().padStart(2, "0")}:${new Date()
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
};

// Collapsible event listener
document.addEventListener("click", (e) => {
  for (let t = e.target; t; t = t.parentElement) {
    if (t.classList.contains("collapsible")) {
      t.classList.toggle("active");
      const c = t.nextElementSibling;
      c.style.maxHeight = c.style.maxHeight ? null : `${c.scrollHeight}px`;
      return;
    }
  }
});

// Text input event listener
// Text input event listener
document.getElementById("textInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    getResponse();
  }
});

// Initialize the chatbox with the first bot message
const firstBotMessage = () => {
  document.getElementById("botStarterMessage").innerHTML = `
    <p class="botText"><span>${
      window.vionikoaiChat.firstMessage || "Say Something..."
    }</span></p>`;
  document.getElementById("chat-timestamp").append(getTime());
  document.getElementById("userInput").scrollIntoView(false);
};

// Function to get bot response
const getResponse = async () => {
  const userText = document.getElementById("textInput").value;
  appendMessage(userText, "user");
  document.getElementById("textInput").value = "";
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
  await getBotResponse(userText);
};

// Function to send text with a button
const buttonSendText = (sampleText) => {
  document.getElementById("textInput").value = "";
  //appendMessage(sampleText, "user");
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
};

// Function to get bot response from an API
async function getBotResponse(input) {
  appendMessage("", "bot");
  const currentMessageElement =
    document.getElementById("chatbox").lastElementChild;
  currentMessageElement.classList.add("loader");
  try {
    const requestData = {
      userId: window.vionikoaiChat?.userId,
      prompt: input,
      fileName: window.vionikoaiChat?.fileName,
      chatId: window.vionikoaiChat?.chatId,
      chatName: window.vionikoaiChat?.chatName,
      name: window.vionikoaiChat?.name,
      email: window.vionikoaiChat?.email,
      phone: window.vionikoaiChat?.phone,
      embedded: true,
      previousMessages,
      temperature: Number(window.vionikoaiChat?.temperature),
    };
    const fileContent = await getFileContent();
    const context = await contextRetriever(fileContent, input);
    currentMessageElement.classList.remove("loader");
    const prompt = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer. Answers should be based on context and not known facts 
  ----------------
  CONTEXT: ${context}
  ----------------
  QUESTION: ${input}
  ----------------
  Helpful Answer:`;

    const extendedMessages = [
      ...previousMessages,
      { role: "user", content: prompt },
    ];
    const response = await fetchResponse(
      extendedMessages,
      window.vionikoaiChat?.userId
    );
    previousMessages.push({
      role: "user",
      content: input,
    });

    let accumulatedData = "";
    let accumulatedContent = "";
    const reader = response; //response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      accumulatedData += new TextDecoder().decode(value);
      const match = accumulatedData.match(/data: (.*?})\s/);

      if (match && match[1]) {
        let jsonData;
        try {
          jsonData = JSON.parse(match[1]);
          if (jsonData.choices[0].finish_reason === "stop") {
            // First fetch request
            fetch(
              "https://us-central1-vioniko-82fcb.cloudfunctions.net/saveChatAndWordCount",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: requestData.userId,
                  chatId: requestData.chatId,
                  chatName: requestData.chatName,
                  name: requestData.name,
                  email: requestData.email,
                  phone: requestData.phone,
                  fileName: requestData.fileName,
                  message: input,
                  role: "user",
                }),
              }
            )
              .then((res) => res.json())
              .then((data) => {
                console.log(data);

                // Second fetch request inside the .then() of the first fetch
                return fetch(
                  "https://us-central1-vioniko-82fcb.cloudfunctions.net/saveChatAndWordCount",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: requestData.userId,
                      chatId: requestData.chatId,
                      chatName: requestData.chatName,
                      name: requestData.name,
                      email: requestData.email,
                      phone: requestData.phone,
                      fileName: requestData.fileName,
                      message: accumulatedContent,
                      role: "assistant",
                    }),
                  }
                );
              })
              .then((res) => res.json())
              .then((data) => {
                console.log(data);
              })
              .catch((err) => {
                console.error("Error:", err);
              });

            // Break statement
            break;
          }
        } catch (error) {
          continue;
        }

        const { delta } = jsonData.choices[0];
        if (delta && delta.content) {
          accumulatedContent += delta.content;

          if (!currentMessageElement) {
            appendMessage(accumulatedContent, "bot");
            currentMessageElement =
              document.getElementById("chatbox").lastElementChild;
          } else {
            currentMessageElement.querySelector("span").textContent =
              accumulatedContent;
          }
        }
        accumulatedData = accumulatedData.replace(match[0], "");
      }
    }
  } catch (error) {
    console.error("Error:", error);
    appendMessage("An error occurred. Please try again later.", "bot");
    document.getElementById("chat-bar-bottom").scrollIntoView(true);
  } finally {
    previousMessages.push(
      {
        role: "user",
        content: input,
      },
      {
        role: "assistant",
        content: currentMessageElement.querySelector("span").textContent,
      }
    );
    document.getElementById("chat-bar-bottom").scrollIntoView(true);
  }
}

// Initialize the chat
firstBotMessage();
