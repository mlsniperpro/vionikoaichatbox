async function performSimilaritySearchOnDocument({ conversationId, query }) {
  const API_URL = "https://vector-databases.fly.dev";
  console.log("Starting similarity search with:", { conversationId, query });

  // Create embedding using fetch (already using fetch)
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
  console.log("Generated embedding vector length:", embeddingVector.length);

  // Replace axios call with fetch for Zilliz search
  console.log("Making Zilliz search request...");
  const response = await fetch(`${API_URL}/zilliz/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      collection_name: "chat",
      //filter: `conversationId == "${conversationId}"`,  // Add explicit filter expression
      queryVector: embeddingVector,
      conversationId: conversationId,
      limit: 22,
    }),
  });

  const responseData = await response.json();
  //console.log("Zilliz search response:", responseData);

  return responseData.data.map((item) => ({
    content: item.content,
    pageNumber: item.pageNumber,
  }));
}
async function fetchApiModel() {
  // Try to get the cached data from sessionStorage
  const cachedData = sessionStorage.getItem("apiModelData");
  if (cachedData !== null) {
    return JSON.parse(cachedData); // Parse the string back into JSON
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
    // Store the result in sessionStorage after converting it to a string
    sessionStorage.setItem("apiModelData", JSON.stringify(result.data));
    return result.data;
  } else {
    throw new Error(
      `Failed to query function: ${response.status} ${response.statusText}`
    );
  }
}

//The file retrieval logic ends here
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
    conversationId: window.parent.vionikoaiChat?.conversationId,
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

  try {
    // Use the new performSimilaritySearchOnDocument function
    const similarDocs = await performSimilaritySearchOnDocument({
      conversationId: requestData.conversationId,
      query: userMessage,
    });

    // Combine the context from similar documents
    const context = similarDocs.map((doc) => doc.content).join("\n");

    const prompt = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer. Answers should be based on context and not known facts 
    ----------------
    CONTEXT: ${context}
    ----------------
    QUESTION: ${userMessage}
    ----------------
    Helpful Answer:`;

    const extendedMessages = [
      ...previousMessages,
      { role: "user", content: prompt },
    ];

    let accumulatedData = "";
    let accumulatedContent = "";
    const reader = await fetchResponse(
      extendedMessages,
      window.parent.vionikoaiChat?.userId
    );
    chatElement.classList.remove("loader");

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
                  message: requestData.prompt,
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
          console.error("An error occurred:", error);
          throw error;
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
  if (window.chatCount >= 3) {
    console.log("I am now running because window.chatCount is greater than 3");
    document.getElementById("live-support-container").style.display !==
      "block" &&
      (document.getElementById("live-support-container").style.display =
        "block");
  }
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
  /*Now let us select an element with the id vionikoid for later */
  const vionikoid = window.parent.document.getElementById("vionikodiv");
  if (vionikoid) {
    console.log("I found the element with the id vionikoid");
  } else {
    console.error("Element with ID 'vionikodiv' not found");
  }
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
  closeBtn.addEventListener("click", () => {
    document.body.classList.remove("show-chatbot");
    vionikoid.classList.toggle("closed");
  });
  chatbotToggler.addEventListener("click", () => {
    document.body.classList.toggle("show-chatbot");
    vionikoid.classList.toggle("closed");
  });
});
