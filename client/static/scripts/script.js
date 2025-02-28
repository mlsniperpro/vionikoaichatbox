// ## Initialization
const chatbotToggler = document.querySelector(".chatbot-toggler");
const closeBtn = document.querySelector(".close-btn");
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input span");
const inputInitHeight = chatInput.scrollHeight;
const scrollPadding = document.createElement("div");

// Initialize conversation state
let conversationHistory = [];

// Add a padding element to the chatbox
scrollPadding.style.height = "50px"; // Adjust this value based on your input box height
chatbox.appendChild(scrollPadding);

// Function to add message to conversation history
const addToConversationHistory = (role, content) => {
  console.log("Adding to conversation history:", { role, contentLength: content?.length });
  conversationHistory.push({ role, content });
  console.log("Updated conversation history:", { 
    messageCount: conversationHistory.length,
    lastMessage: conversationHistory[conversationHistory.length - 1]
  });
};

// ## Utility Functions
const sanitizeHTML = (str) => {
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
};

const validateUserData = () => {
  if (
    !window.parent.vionikoaiChat?.chatId ||
    window.parent.vionikoaiChat?.name === "Name" ||
    window.parent.vionikoaiChat?.email === "Email" ||
    window.parent.vionikoaiChat?.phone === "Phone"
  ) {
    console.log("User data not yet collected", {
      chatId: window.parent.vionikoaiChat?.chatId,
      name: window.parent.vionikoaiChat?.name,
      email: window.parent.vionikoaiChat?.email,
      phone: window.parent.vionikoaiChat?.phone,
    });
    return false;
  }
  return true;
};

const prepareMessagePayload = (message, role) => {
  console.log("Preparing message payload:", {
    messageLength: message?.length,
    role,
    parentContext: window.parent.vionikoaiChat
  });

  // Truncate message if too long
  const maxLength = 10000;
  const truncatedMessage =
    message?.length > maxLength
      ? message.substring(0, maxLength) + "..."
      : message;

  // Sanitize input to remove any problematic characters
  const sanitizedMessage = sanitizeHTML(truncatedMessage || "");

  // Extract parent context safely
  const parentContext = window.parent.vionikoaiChat || {};
  const {
    userId,
    chatId,
    chatName,
    name,
    email,
    phone,
    fileName,
    conversationId,
    systemPrompt
  } = parentContext;

  const payload = {
    userId,
    chatId,
    chatName,
    name,
    email,
    phone,
    fileName,
    conversationId, // Ensure this is included for API continuity
    message: sanitizedMessage,
    role,
    timestamp: new Date().toISOString(),
  };

  // Include systemPrompt only for the first user message
  if (role === "user" && systemPrompt && !window.chatCount) {
    payload.systemPrompt = systemPrompt;
  }

  console.log("Prepared payload:", {
    hasUserId: !!payload.userId,
    hasChatId: !!payload.chatId,
    hasConversationId: !!payload.conversationId,
    messageLength: payload.message?.length,
    role: payload.role
  });

  return payload;
};

// ## Create Chat Element
const createChatLi = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", className);
  const chatContent = className === "outgoing" ? "<p></p>" : "<p></p>";
  chatLi.innerHTML = chatContent;
  chatLi.querySelector("p").textContent = message;
  return chatLi;
};

// Save chat message to Firebase
const saveChatMessage = async (message, role) => {
  console.log("Attempting to save chat message:", {
    role,
    messageLength: message?.length,
  });

  if (!validateUserData()) {
    console.log("Skipping message save - user data not yet collected");
    return true;
  }

  try {
    const payload = prepareMessagePayload(message, role);
    console.log("Prepared payload for saving:", {
      ...payload,
      messageLength: payload.message?.length,
    });

    // Validate required fields
    const requiredFields = ["userId", "chatId", "name", "email", "phone"];
    const missingFields = requiredFields.filter((field) => !payload[field]);

    if (missingFields.length > 0) {
      console.error("Validation failed - missing required fields:", {
        missingFields,
        payload: JSON.stringify(payload, null, 2),
      });
      return true;
    }

    // Validate message content
    if (!payload.message) {
      console.error("Empty message content - skipping save");
      return true;
    }

    console.log("Starting API request to save message...");
    const response = await fetch(
      "https://us-central1-vioniko-82fcb.cloudfunctions.net/saveChatAndWordCount",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    // Get the response text first
    const responseText = await response.text();
    console.log("Raw response:", responseText);

    if (!response.ok) {
      console.error("API request failed:", {
        status: response.status,
        statusText: response.statusText,
        responseText,
        role: role,
      });
      try {
        if (responseText.trim().startsWith("{")) {
          const errorData = JSON.parse(responseText);
          console.error("Error response data:", errorData);
        }
      } catch (e) {
        console.error("Could not parse error response:", e);
      }
      return true;
    }

    console.log("Successfully saved message:", {
      role,
      status: response.status,
      messageLength: payload.message?.length,
    });
    return true;
  } catch (error) {
    console.error("Exception while saving message:", {
      error: error.message,
      stack: error.stack,
      role: role,
    });
    return true;
  }
};

// Function to handle streaming response
const handleStreamedResponse = async (response, messageElement) => {
  console.log("Starting to process response stream...", {
    responseType: response.type,
    headers: Object.fromEntries(response.headers.entries())
  });
  
  let accumulatedContent = "";
  const decoder = new TextDecoder();
  let chunkCount = 0;

  try {
    const reader = response.body.getReader();
    console.log("Stream reader created successfully");

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log("Stream complete", {
          finalContentLength: accumulatedContent.length,
          totalChunks: chunkCount
        });
        break;
      }

      chunkCount++;
      const text = decoder.decode(value, { stream: true });
      console.log("Received chunk #" + chunkCount, {
        chunkSize: value.length,
        decodedLength: text.length,
        rawChunk: text
      });

      const lines = text.split("\n");
      console.log("Processing chunk lines:", {
        numberOfLines: lines.length,
        lines: lines
      });

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const content = line.slice(6).trim(); // Remove 'data: ' prefix and trim
          if (content) {
            console.log("Processing model response content:", {
              contentLength: content.length,
              content: content,
              currentAccumulatedLength: accumulatedContent.length
            });

            // Add a space before content if it doesn't start with punctuation
            if (content && !content.match(/^[.,!?;:]/)) {
              accumulatedContent += (accumulatedContent ? " " : "") + content;
            } else {
              accumulatedContent += content;
            }

            // Update message element with properly spaced content
            if (messageElement) {
              messageElement.textContent = accumulatedContent;
              console.log("Updated UI with new content", {
                elementText: messageElement.textContent,
                contentLength: accumulatedContent.length,
                lastAddedContent: content,
                scrollPosition: chatbox.scrollTop,
                scrollHeight: chatbox.scrollHeight
              });
            } else {
              console.error("Message element not found for content update", {
                accumulatedContent,
                messageElementExists: !!messageElement
              });
            }

            // Force scroll to bottom after each content update
            const previousScroll = chatbox.scrollTop;
            chatbox.scrollTop = chatbox.scrollHeight;
            console.log("Adjusted scroll position", {
              previous: previousScroll,
              new: chatbox.scrollTop,
              scrollHeight: chatbox.scrollHeight
            });
          }
        }
      }
    }

    console.log("Stream processing complete", {
      finalLength: accumulatedContent.length,
      totalChunks: chunkCount,
      messageElementExists: !!messageElement,
      finalScrollPosition: chatbox.scrollTop
    });

    // Add assistant's response to conversation history
    addToConversationHistory('assistant', accumulatedContent);

    return accumulatedContent;
  } catch (error) {
    console.error("Stream processing error:", {
      error: error.message,
      stack: error.stack,
      phase: "streaming",
      accumulatedLength: accumulatedContent.length,
      processedChunks: chunkCount
    });
    throw error;
  }
};

// Function to generate a chat response from the server
const generateResponse = async (chatElement, userMessage) => {
  const messageElement = chatElement.querySelector("p");
  console.log("Starting bot response request:", { 
    userMessage,
    messageElementExists: !!messageElement,
    chatElementClasses: chatElement.className
  });

  try {
    // Log initial state
    console.log("Initial chat state:", {
      windowParentExists: !!window.parent,
      vionikoaiChatExists: !!window.parent?.vionikoaiChat,
      conversationId: window.parent.vionikoaiChat?.conversationId,
      userId: window.parent.vionikoaiChat?.userId
    });

    // Add user message to conversation history
    addToConversationHistory('user', userMessage);
    
    // Get complete payload with all context
    const messagePayload = prepareMessagePayload(userMessage, "user");
    
    // Prepare API specific payload with full conversation history
    const payload = {
      conversationId: messagePayload.conversationId,
      userId: messagePayload.userId,
      messages: []
    };

    // Add system prompt as first message if this is the first interaction
    if (!window.chatCount && messagePayload.systemPrompt) {
      conversationHistory.unshift({
        role: 'system',
        content: messagePayload.systemPrompt
      });
    }

    // Map conversation history to API format
    payload.messages = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system' : 'assistant',
      content: msg.content
    }));

    console.log("Sending conversation history:", {
      messageCount: conversationHistory.length,
      messages: conversationHistory
    });

    console.log("Preparing API request:", {
      endpoint: "https://llm-functionalities.fly.dev/chatrag",
      payload: JSON.stringify(payload, null, 2)
    });

    console.log("Initiating fetch request...");
    const response = await fetch(
      "https://llm-functionalities.fly.dev/chatrag",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        mode: "cors",
        credentials: "omit",
        body: JSON.stringify(payload),
      }
    );

    console.log("Received initial response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      type: response.type,
      bodyUsed: response.bodyUsed
    });

    if (!response.ok) {
      console.error("Chatrag API request failed:", {
        status: response.status,
        statusText: response.statusText,
        type: response.type,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Successfully received response from chatrag API");
    chatElement.classList.remove("loader");

    console.log("Starting stream processing...");
    const accumulatedContent = await handleStreamedResponse(
      response,
      messageElement
    );
    console.log("Stream processing complete:", {
      contentLength: accumulatedContent?.length,
      hasContent: !!accumulatedContent
    });

    // After streaming completes, update chat count
    const previousCount = window.chatCount || 0;
    window.chatCount ? window.chatCount++ : (window.chatCount = 1);
    console.log("Updated chat count:", {
      previous: previousCount,
      current: window.chatCount
    });

    // Save messages
    console.log("Saving chat messages...");
    await Promise.all([
      saveChatMessage(userMessage, "user"),
      saveChatMessage(accumulatedContent, "assistant"),
    ]);
    console.log("Messages saved successfully");

    // Final state check
    console.log("Response generation complete:", {
      messageElementContent: messageElement.textContent,
      chatElementClasses: chatElement.className,
      finalScrollPosition: chatbox.scrollTop
    });

  } catch (error) {
    console.error("Error in generateResponse:", {
      error: error.message,
      stack: error.stack,
      phase: "response_generation",
      userMessage: userMessage,
      messageElementExists: !!messageElement
    });
    messageElement.textContent = "An error occurred. Please try again.";
    chatElement.classList.remove("loader");
  }
};

// ## Handle Chat
const handleChat = async (chatInput, chatbox, inputInitHeight) => {
  if (window.chatCount >= 3) {
    console.log("Chat count threshold reached:", { count: window.chatCount });
    const supportContainer = document.getElementById("live-support-container");
    if (supportContainer && supportContainer.style.display !== "block") {
      console.log("Displaying live support container");
      supportContainer.style.display = "block";
    }
  }

  const userMessage = chatInput.value.trim();
  if (!userMessage) {
    console.log("Empty message - ignoring");
    return;
  }

  console.log("Processing user message:", {
    messageLength: userMessage.length,
  });

  // Reset input
  chatInput.value = "";
  chatInput.style.height = `${inputInitHeight}px`;

  // Create and add outgoing message
  const outgoingMessage = createChatLi(userMessage, "outgoing");
  chatbox.appendChild(outgoingMessage);
  chatbox.scrollTop = chatbox.scrollHeight;

  // Create and add incoming message with loader
  const incomingChatLi = createChatLi("", "incoming");
  incomingChatLi.classList.add("loader");
  chatbox.appendChild(incomingChatLi);
  chatbox.scrollTop = chatbox.scrollHeight;

  // Generate response
  await generateResponse(incomingChatLi, userMessage);
};

// Initialize the chatbox with the first bot message
const firstBotMessage = () => {
  console.log("Initializing first bot message", {
    firstMessage: window.parent.vionikoaiChat?.firstMessage,
    systemPrompt: window.parent.vionikoaiChat?.systemPrompt
  });

  // Create and append the first bot message
  const firstMessage = window.parent.vionikoaiChat?.firstMessage || "Say Something...";
  const messageElement = createChatLi(firstMessage, "incoming");
  chatbox.appendChild(messageElement);

  // Add first message to conversation history
  addToConversationHistory('assistant', firstMessage);

  // If there's a system prompt, add it first
  if (window.parent.vionikoaiChat?.systemPrompt) {
    conversationHistory.unshift({
      role: 'system',
      content: window.parent.vionikoaiChat.systemPrompt
    });
    console.log("Added system prompt to conversation history");
  }

  // Update timestamp and scroll
  console.log("Adding first message to chat:", {
    messageLength: firstMessage.length,
    historyLength: conversationHistory.length
  });
  chatbox.scrollTop = chatbox.scrollHeight;
};

// ## Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  try {
    console.log("Initializing chat event listeners");

    const vionikoid = window.parent.document.getElementById("vionikodiv");
    if (vionikoid) {
      console.log("Found vionikodiv element");
      // Initialize chat with first message
      firstBotMessage();
    } else {
      console.error("Element with ID 'vionikodiv' not found");
    }

    // Input height adjustment
    chatInput.addEventListener("input", () => {
      chatInput.style.height = `${inputInitHeight}px`;
      chatInput.style.height = `${chatInput.scrollHeight}px`;
    });

    // Enter key handler
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleChat(chatInput, chatbox, inputInitHeight);
      }
    });

    // Send button handler
    sendChatBtn.addEventListener("click", () =>
      handleChat(chatInput, chatbox, inputInitHeight)
    );

    // Close button handler
    closeBtn.addEventListener("click", () => {
      document.body.classList.remove("show-chatbot");
      vionikoid?.classList.toggle("closed");
    });

    // Toggle button handler
    chatbotToggler.addEventListener("click", () => {
      document.body.classList.toggle("show-chatbot");
      vionikoid?.classList.toggle("closed");
    });

    console.log("Chat event listeners initialized successfully");
  } catch (error) {
    console.error("Error initializing chat:", {
      error: error.message,
      stack: error.stack,
    });
  }
});
