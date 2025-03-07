async function fetchApiModel() {
  // Try to get the cached data from sessionStorage
  const cachedData = sessionStorage.getItem("apiModelData");
  if (cachedData !== null) {
    return JSON.parse(cachedData);
  }

  const response = await fetch(
    "https://us-central1-vioniko-82fcb.cloudfunctions.net/getApiKey",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (response.ok) {
    const result = await response.json();
    sessionStorage.setItem("apiModelData", JSON.stringify(result.data));
    return result.data;
  } else {
    throw new Error(
      `Failed to query function: ${response.status} ${response.statusText}`
    );
  }
}

// The fetch response logic
const fetchResponse = async (chat, userId) => {
  const data = await fetchApiModel();
  const signature = data.apiKey;
  try {
    console.log("I am now fetching the response");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + signature,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: data.model,
        messages: chat,
        stream: true,
      }),
    });
    if (!response.ok) {
      throw new Error(`API responded with HTTP ${response.status}`);
    }
    return response.body.getReader();
  } catch (error) {
    console.error("Error fetching response:", error);
    throw error;
  }
};

async function performSimilaritySearchOnDocument({ conversationId, query }) {
  const API_URL = "https://vector-databases.fly.dev";
  console.log("Starting similarity search with:", { conversationId, query });

  // Create embedding using fetch
  const embeddingsResponse = await fetch(
    "https://llm-functionalities.fly.dev/create-embedding",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: query,
        model: "text-embedding-3-large",
      }),
    }
  );

  const embeddingsData = await embeddingsResponse.json();
  const embeddingVector = embeddingsData.embedding;

  // Zilliz search
  const response = await fetch(`${API_URL}/zilliz/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      collection_name: "chat",
      queryVector: embeddingVector,
      conversationId: conversationId,
      limit: 10,
    }),
  });

  const responseData = await response.json();
  return responseData.data.map((item) => ({
    content: item.content,
    pageNumber: item.pageNumber,
  }));
}

const previousMessages = [
  {
    role: "system",
    content: window.vionikoaiChat?.systemPrompt || "",
  },
];

// Function to append messages to the chatbox
const appendMessage = (message, type) => {
  const chatbox = document.getElementById("chatbox");
  const parsedMessage = message;
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
  if (window.chatCount >= 3) {
    document.getElementById("chat-live-support").style.display !== "block" &&
      (document.getElementById("chat-live-support").style.display = "block");
  }
  const userText = document.getElementById("textInput").value;
  appendMessage(userText, "user");
  document.getElementById("textInput").value = "";
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
  await getBotResponse(userText);
};

// Function to send text with a button
const buttonSendText = (sampleText) => {
  document.getElementById("textInput").value = "";
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
      conversationId: window.vionikoaiChat?.conversationId,
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

    // Use performSimilaritySearchOnDocument for context retrieval
    const similarDocs = await performSimilaritySearchOnDocument({
      conversationId: requestData.conversationId,
      query: input,
    });

    const context = similarDocs.map((doc) => doc.content).join("\n");
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

    const reader = await fetchResponse(
      extendedMessages,
      window.vionikoaiChat?.userId
    );

    let accumulatedData = "";
    let accumulatedContent = "";

    while (true) {
      const { done, value } = await reader.read();
      accumulatedData += new TextDecoder().decode(value);
      const match = accumulatedData.match(/data: (.*?})\s/);

      if (match && match[1]) {
        let jsonData;
        try {
          jsonData = JSON.parse(match[1]);
          if (jsonData.choices[0].finish_reason === "stop") {
            window.chatCount ? window.chatCount++ : (window.chatCount = 1);

            // Save chat history
            await fetch(
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
            );

            await fetch(
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
