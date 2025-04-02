async function performSimilaritySearchOnDocument({ conversationId, query }) {
  const API_URL = "https://vector-databases.fly.dev";
  console.log("Starting similarity search with:", { conversationId, query });

  try {
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

    if (!embeddingsResponse.ok) {
      const errorText = await embeddingsResponse.text();
      console.error("Embedding API error:", {
        status: embeddingsResponse.status,
        statusText: embeddingsResponse.statusText,
        errorText,
      });
      throw new Error(
        `Failed to create embedding: ${embeddingsResponse.status} ${embeddingsResponse.statusText}`
      );
    }

    const embeddingsData = await embeddingsResponse.json();
    if (!embeddingsData.embedding) {
      console.error("Invalid embedding response:", embeddingsData);
      throw new Error("Invalid embedding response: embedding vector not found");
    }

    const embeddingVector = embeddingsData.embedding;
    console.log("Generated embedding vector length:", embeddingVector.length);

    // Zilliz search request
    console.log("Making Zilliz search request...");
    const response = await fetch(`${API_URL}/zilliz/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        collection_name: "chat",
        queryVector: embeddingVector,
        conversationId: conversationId,
        limit: 22,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Zilliz search API error:", {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      throw new Error(
        `Zilliz search failed: ${response.status} ${response.statusText}`
      );
    }

    const responseData = await response.json();

    if (!responseData.data || !Array.isArray(responseData.data)) {
      console.error("Invalid Zilliz search response:", responseData);
      throw new Error("Invalid search response format");
    }

    return responseData.data.map((item) => ({
      content: item.content,
      pageNumber: item.pageNumber,
    }));
  } catch (error) {
    console.error("Error in similarity search:", error);
    // Return empty results rather than failing the entire operation
    return [];
  }
}
async function fetchApiModel() {
  // Try to get the cached data from sessionStorage
  const cachedData = sessionStorage.getItem("apiModelData");
  if (cachedData !== null) {
    return JSON.parse(cachedData);
  }

  const response = await fetch("https://www.chatvioniko.com/api/models", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.ok) {
    const result = await response.json();

    // Get the preferred provider, defaulting to openai
    const provider = result.defaultProvider || "openai";

    // First try to find embedded model from default provider
    let selectedModel = result.models.find(
      (model) => model.sectionId === "embedded" && model.provider === provider
    );

    // If not found and provider isn't openai, fall back to openai
    if (!selectedModel && provider !== "openai") {
      console.warn(
        `No embedded model found for provider ${provider}, falling back to OpenAI`
      );
      selectedModel = result.models.find(
        (model) => model.sectionId === "embedded" && model.provider === "openai"
      );
    }

    if (!selectedModel) {
      throw new Error("No suitable embedded model found in available models");
    }

    // Get the provider API key
    const providerKey = result.providers[selectedModel.provider];
    if (!providerKey) {
      throw new Error(
        `API key not found for provider: ${selectedModel.provider}`
      );
    }

    const data = {
      model: selectedModel.id,
      provider: selectedModel.provider,
      apiKey: providerKey,
      name: selectedModel.name,
      displayName: selectedModel.displayName,
      maxLength: selectedModel.maxLength,
      tokenLimit: selectedModel.tokenLimit,
    };

    // Store the result in sessionStorage
    sessionStorage.setItem("apiModelData", JSON.stringify(data));
    return data;
  } else {
    throw new Error(
      `Failed to query function: ${response.status} ${response.statusText}`
    );
  }
}

//The file retrieval logic ends here
const fetchResponse = async (chat, userId) => {
  try {
    const data = await fetchApiModel();
    const signature = data.apiKey;

    console.log("I am now fetching the response");

    // Currently only supporting OpenAI, but structured for future providers
    let endpoint;
    let payload;

    switch (data.provider) {
      case "openai":
        endpoint = "https://api.openai.com/v1/chat/completions";
        payload = {
          model: data.model,
          messages: chat,
          stream: true,
         // max_tokens: Math.floor(data.tokenLimit * 0.9), // Leave 10% for safety
        };
        break;
      case "anthropic":
      case "deepseek":
      case "xai":
        throw new Error(`Provider ${data.provider} support coming soon`);
      default:
        throw new Error(`Unknown provider: ${data.provider}`);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + signature,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("I got the response");

    if (!response.ok) {
      // Get the detailed error message from the response
      const errorData = await response.json();
      console.error("Full API error:", errorData);
      throw new Error(
        `API responded with HTTP ${response.status}: ${JSON.stringify(
          errorData
        )}`
      );
    }

    console.log("I returned the response immediately");
    return response.body.getReader();
  } catch (error) {
    console.error("Error fetching response:", error);
    throw error; // Propagate the error to the calling function
  }
};
// ## Initialization
const chatbotToggler = document.querySelector(".chatbot-toggler");

// Initialize messages array with just the system prompt
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
    // Use the performSimilaritySearchOnDocument function
    const similarDocs = await performSimilaritySearchOnDocument({
      conversationId: requestData.conversationId,
      query: userMessage,
    });

    // Store only unique and relevant context pieces
    const uniqueContexts = new Set(similarDocs.map((doc) => doc.content));
    const context = Array.from(uniqueContexts).join("\n");

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

    try {
      const reader = await fetchResponse(
        extendedMessages,
        window.parent.vionikoaiChat?.userId
      );
      chatElement.classList.remove("loader");

      while (true) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            // If the stream ends without a stop signal, handle gracefully
            if (accumulatedContent) {
              break;
            } else {
              throw new Error("Stream ended unexpectedly");
            }
          }

          const decodedChunk = new TextDecoder().decode(value);
          accumulatedData += decodedChunk;

          // Look for data chunks in the SSE stream
          const regex = /data: ({.*?})\n/g;
          let match;

          while ((match = regex.exec(accumulatedData)) !== null) {
            try {
              const jsonData = JSON.parse(match[1]);

              if (jsonData.choices && jsonData.choices[0]) {
                if (jsonData.choices[0].finish_reason === "stop") {
                  window.chatCount
                    ? window.chatCount++
                    : (window.chatCount = 1);

                  // Save chat history in parallel
                  Promise.all([
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
                          message: requestData.prompt,
                          role: "user",
                        }),
                      }
                    ).catch((err) =>
                      console.error("Error saving user message:", err)
                    ),

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
                          message: accumulatedContent,
                          role: "assistant",
                        }),
                      }
                    ).catch((err) =>
                      console.error("Error saving assistant message:", err)
                    ),
                  ]);

                  // Exit the while loop when finished
                  return;
                }

                const { delta } = jsonData.choices[0];
                if (delta && delta.content) {
                  accumulatedContent += delta.content;
                  messageElement.textContent = accumulatedContent;
                }
              }

              // Remove the processed data
              accumulatedData = accumulatedData.replace(match[0], "");
            } catch (parseError) {
              console.error(
                "Error parsing JSON:",
                parseError,
                "Data:",
                match[1]
              );
              // Continue to next chunk if one fails
              accumulatedData = accumulatedData.replace(match[0], "");
            }
          }
        } catch (readError) {
          console.error("Error reading stream:", readError);
          throw readError;
        }
      }
    } catch (streamError) {
      console.error("Stream processing error:", streamError);
      throw streamError;
    }
  } catch (error) {
    console.error("Error generating response:", error);

    // Provide more specific error messages based on the error type
    let errorMessage = "An error occurred. Please try again.";

    if (
      error.message.includes("API responded with HTTP 401") ||
      error.message.includes("API responded with HTTP 403")
    ) {
      errorMessage = "Authentication error. Please check your API key.";
    } else if (error.message.includes("API responded with HTTP 429")) {
      errorMessage = "Rate limit exceeded. Please try again later.";
    } else if (error.message.includes("API responded with HTTP 400")) {
      if (error.message.includes("maximum context length")) {
        errorMessage = "The conversation is too long. Please start a new chat.";
      } else {
        errorMessage =
          "There was an issue with your request. Please try again.";
      }
    } else if (
      error.message.includes("Network Error") ||
      error.message.includes("Failed to fetch")
    ) {
      errorMessage = "Network error. Please check your internet connection.";
    }

    messageElement.textContent = errorMessage;
  } finally {
    // Add message to history only if there's content
    if (
      messageElement.textContent &&
      messageElement.textContent !== "An error occurred. Please try again."
    ) {
      previousMessages.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: messageElement.textContent }
      );
    } else {
      // Just add user message if assistant message failed
      previousMessages.push({ role: "user", content: userMessage });
    }

    // Always remove loader
    chatElement.classList.remove("loader");
  }
};

// ## Handle Chat
// Function to handle chat interactions
const handleChat = async (chatInput, chatbox, inputInitHeight) => {
  if (window.chatCount >= 3) {
    console.log("I am now running because window.chatCount is greater than 3");
    // Access live-support-container within the iframe context
    const iframe = window.parent.document.querySelector("#vionikodiv iframe");
    try {
      if (iframe && iframe.contentWindow && !iframe.contentWindow.closed) {
        const liveSupportContainer =
          iframe.contentWindow.document.getElementById(
            "live-support-container"
          );
        if (liveSupportContainer && window.parent.vionikoaiChat?.supportType) {
          liveSupportContainer.style.display = "block";
        }
      }
    } catch (e) {
      console.log("Could not access iframe content - it may not be loaded yet");
    }
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
