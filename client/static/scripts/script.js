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
    userId: window.parent.vionikoaiChat?.userId,
    fileName: window.parent.vionikoaiChat?.fileName,
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
// ## Initialization
const chatbotToggler = document.querySelector(".chatbot-toggler");
const previousMessages = [
  {
    role: "system",
    content: window.parent.vionikoaiChat?.systemPrompt || "",
  },
];
const closeBtn = document.querySelector(".close-btn");
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input span");
const inputInitHeight = chatInput.scrollHeight;
const scrollPadding = document.createElement("div");
// Add a padding element to the chatbox
scrollPadding.style.height = "50px"; // Adjust this value based on your input box height
chatbox.appendChild(scrollPadding);
// ## Create Chat Element
// Function to create a new chat element
const createChatLi = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", className);
  const chatContent = className === "outgoing" ? "<p></p>" : "<p></p>";
  chatLi.innerHTML = chatContent;
  chatLi.querySelector("p").textContent = message;
  return chatLi;
};

// Function to generate a chat response from the server
const generateResponse = async (chatElement, userMessage) => {
  const messageElement = chatElement.querySelector("p");
  const requestData = {
    userId: window.parent.vionikoaiChat?.userId,
    prompt: userMessage,
    fileName: window.parent.vionikoaiChat?.fileName,
    chatId: window.parent.vionikoaiChat?.chatId,
    chatName: window.parent.vionikoaiChat?.chatName,
    name: window.parent.vionikoaiChat?.name,
    email: window.parent.vionikoaiChat?.email,
    phone: window.parent.vionikoaiChat?.phone,
    embedded: true,
    previousMessages,
    temperature: Number(window.parent.vionikoaiChat?.temperature),
  };
  const fileContent = await getFileContent();
  const context = await contextRetriever(fileContent, userMessage); 
  const prompt = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer. Answers should be based on context and not known facts 
  ----------------
  CONTEXT: ${context}
  ----------------
  QUESTION: ${userMessage}
  ----------------
  Helpful Answer:`;
  const extendedMessages = [...previousMessages,
  {role: "user", "content": prompt}];

  try {
    let accumulatedData = "";
    let accumulatedContent = "";
    const reader = await fetchResponse(extendedMessages, window.parent.vionikoaiChat?.userId);
    chatElement.classList.remove("loader");
    while (true) {
      const { done, value } = await reader.read();
      accumulatedData += new TextDecoder().decode(value);
      const match = accumulatedData.match(/data: (.*?})\s/);

      if (match && match[1]) {
        let jsonData;
        try {
          jsonData = JSON.parse(match[1]);
          if (jsonData.choices[0].finish_reason === "stop") break;
        } catch (error) {
          continue;
        }

        const { delta } = jsonData.choices[0];
        if (delta && delta.content) {
          accumulatedContent += delta.content;
          messageElement.textContent = accumulatedContent;
        }
        accumulatedData = accumulatedData.replace(match[0], "");
      }
    }
  } catch (error) {
    console.error("An error occurred:", error);
    messageElement.textContent = "An error occurred. Please try again.";
  } finally {
    previousMessages.push({
      role: "user",
      content: userMessage,
    });
    previousMessages.push({
      role: "assistant",
      content: messageElement.textContent,
    });
    chatElement.classList.remove("loader");
  }
};

// ## Handle Chat
// Function to handle chat interactions
const handleChat = async (chatInput, chatbox, inputInitHeight) => {
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;
  chatInput.value = "";
  chatInput.style.height = `${inputInitHeight}px`;
  chatbox.appendChild(createChatLi(userMessage, "outgoing"));
  chatbox.scrollTop = chatbox.scrollHeight;
  const incomingChatLi = createChatLi("", "incoming");
  incomingChatLi.classList.add("loader");
  chatbox.appendChild(incomingChatLi);
  chatbox.scrollTop = chatbox.scrollHeight;
  await generateResponse(incomingChatLi, userMessage);
};

// ## Event Listeners
// Attach event listeners to DOM elements
document.addEventListener("DOMContentLoaded", () => {
  chatInput.addEventListener("input", () => {
    chatInput.style.height = `${inputInitHeight}px`;
    chatInput.style.height = `${chatInput.scrollHeight}px`;
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChat(chatInput, chatbox, inputInitHeight);
    }
  });

  sendChatBtn.addEventListener("click", () =>
    handleChat(chatInput, chatbox, inputInitHeight)
  );
  closeBtn.addEventListener("click", () =>
    document.body.classList.remove("show-chatbot")
  );
  chatbotToggler.addEventListener("click", () =>
    document.body.classList.toggle("show-chatbot")
  );
});
