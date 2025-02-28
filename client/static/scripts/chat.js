// Initialize conversation state
let conversationHistory = [];

// Function to add message to conversation history
const addToConversationHistory = (role, content) => {
  console.log("Adding to conversation history:", { role, contentLength: content?.length });
  conversationHistory.push({ role, content });
  console.log("Updated conversation history:", { 
    messageCount: conversationHistory.length,
    lastMessage: conversationHistory[conversationHistory.length - 1]
  });
};

// Function to sanitize HTML
const sanitizeHTML = (str) => {
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
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
    console.log("I am now running because window.chatCount is greater than 3");
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
  //appendMessage(sampleText, "user");
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
};

// Function to save chat message
const saveChatMessage = async (message, role, input = "") => {
  console.log("Attempting to save chat message:", {
    role,
    messageLength: message?.length,
  });
  console.log("Current vionikoaiChat state:", { ...window.vionikoaiChat });

  // Only attempt to save if we have valid user data
  if (
    !window.vionikoaiChat?.chatId ||
    window.vionikoaiChat?.name === "Name" ||
    window.vionikoaiChat?.email === "Email" ||
    window.vionikoaiChat?.phone === "Phone"
  ) {
    console.log("Skipping message save - user data not yet collected", {
      chatId: window.vionikoaiChat?.chatId,
      name: window.vionikoaiChat?.name,
      email: window.vionikoaiChat?.email,
      phone: window.vionikoaiChat?.phone,
    });
    return true; // Return true to allow chat to continue
  }

  try {
    const messageContent = role === "user" ? input : message;

    // Truncate message if too long
    const maxLength = 1000000; // Set a reasonable limit
    const truncatedMessage =
      messageContent?.length > maxLength
        ? messageContent.substring(0, maxLength) + "..."
        : messageContent;

    // Sanitize input to remove any problematic characters
    const sanitizedMessage = sanitizeHTML(truncatedMessage || "");

    const payload = {
      userId: window.vionikoaiChat.userId,
      chatId: window.vionikoaiChat.chatId,
      chatName: window.vionikoaiChat.chatName,
      name: window.vionikoaiChat.name,
      email: window.vionikoaiChat.email,
      phone: window.vionikoaiChat.phone,
      fileName: window.vionikoaiChat.fileName,
      message: sanitizedMessage,
      role: role,
      timestamp: new Date().toISOString(), // Add timestamp for better tracking
    };

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
      return true; // Return true to allow chat to continue
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
        // Only try to parse as JSON if it looks like JSON
        if (responseText.trim().startsWith("{")) {
          const errorData = JSON.parse(responseText);
          console.error("Error response data:", errorData);
        }
      } catch (e) {
        console.error("Could not parse error response:", e);
      }
      return true; // Return true to allow chat to continue
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
    return true; // Return true to allow chat to continue
  }
};

// Function to get bot response from chatrag API
async function getBotResponse(input) {
  console.log("Starting bot response request:", { input });

  appendMessage("", "bot");
  const currentMessageElement =
    document.getElementById("chatbox").lastElementChild;
  currentMessageElement.classList.add("loader");

  try {
    // Add user message to conversation history
    addToConversationHistory('user', input);

    // Prepare API payload with full conversation history
    const payload = {
      conversationId: window.vionikoaiChat?.conversationId,
      userId: window.vionikoaiChat?.userId,
      messages: []
    };

    // Add system prompt as first message if this is the first interaction
    if (!window.chatCount && window.vionikoaiChat?.systemPrompt) {
      conversationHistory.unshift({
        role: 'system',
        content: window.vionikoaiChat.systemPrompt
      });
    }

    // Map conversation history to API format
    payload.messages = conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system' : 'assistant',
      content: msg.content
    }));

    console.log("Sending conversation history:", {
      messageCount: conversationHistory.length,
      messages: conversationHistory,
      systemPrompt: window.vionikoaiChat?.systemPrompt
    });

    console.log("Sending request to chatrag API:", {
      endpoint: "https://llm-functionalities.fly.dev/chatrag",
      payload: JSON.stringify(payload, null, 2),
      historyLength: conversationHistory.length
    });

    const response = await fetch(
      "https://llm-functionalities.fly.dev/chatrag",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "cors",
        credentials: "omit",
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      console.error("Chatrag API request failed:", {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log("Successfully received response from chatrag API");

    currentMessageElement.classList.remove("loader");
    let accumulatedContent = "";

    try {
      console.log("Starting to process response stream...");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        console.log("Decoded chunk:", text);

        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const content = line.slice(6); // Remove 'data: ' prefix
            if (content.trim()) {
              console.log("Processing content:", {
                content,
                contentLength: content.length,
                currentAccumulatedLength: accumulatedContent.length
              });

              // Add a space before content if it doesn't start with punctuation
              if (content && !content.match(/^[.,!?;:]/)) {
                accumulatedContent += (accumulatedContent ? " " : "") + content;
              } else {
                accumulatedContent += content;
              }

              const messageSpan = currentMessageElement.querySelector("span");
              if (messageSpan) {
                messageSpan.textContent = accumulatedContent;
                console.log("Updated message content:", {
                  contentLength: accumulatedContent.length,
                  lastAddedContent: content,
                  fullContent: accumulatedContent
                });
              } else {
                console.error("Message span element not found");
              }
            }
          }
        }
      }

      console.log("Stream processing complete:", {
        finalLength: accumulatedContent.length,
        contentType: typeof accumulatedContent
      });

      // Add assistant's response to conversation history
      addToConversationHistory('assistant', accumulatedContent);

      // After streaming completes, update chat count
      window.chatCount ? window.chatCount++ : (window.chatCount = 1);
      console.log("Updated chat count:", {
        current: window.chatCount,
        historyLength: conversationHistory.length
      });

      // Save messages
      await Promise.all([
        saveChatMessage(input, "user", input),
        saveChatMessage(accumulatedContent, "assistant"),
      ]);

      console.log("Messages saved successfully");
    } catch (error) {
      console.error("Streaming error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error:", error);
    currentMessageElement.classList.remove("loader");
    appendMessage("An error occurred. Please try again later.", "bot");
  } finally {
    document.getElementById("chat-bar-bottom").scrollIntoView(true);
  }
}

// Initialize the chat
firstBotMessage();
