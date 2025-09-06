

// Replace API key handling functions with a secure proxy approach
async function streamFromProxyApi(userMessage) {
  try {
    console.log("Starting proxy API request with message:", userMessage);
    const response = await fetch("https://www.chatvioniko.com/api/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      mode: "cors",
      credentials: "omit",
      body: JSON.stringify({
        messages: [{ role: "user", content: userMessage }],
        systemPrompt: window.parent.vionikoaiChat?.systemPrompt || "",
        conversationId: window.parent.vionikoaiChat?.conversationId,
        userId: window.parent.vionikoaiChat?.userId,
        data: {
          fileName: window.parent.vionikoaiChat?.fileName,
          chatId: window.parent.vionikoaiChat?.chatId,
        },
        language: "English",
        origin: "embedded",
      }),
    });

    if (!response.ok) {
      throw new Error(`API responded with HTTP ${response.status}`);
    }

    console.log("Proxy API response received, status:", response.status);
    return response; // Return the full response
  } catch (error) {
    console.error("Error streaming chat response:", error);
    throw error;
  }
}

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

// Function to generate a chat response from the server - updated to use proxy
const generateResponse = async (chatElement, userMessage) => {
  const messageElement = chatElement.querySelector("p");
  const requestData = {
    conversationId: window.parent.vionikoaiChat?.conversationId,
    userId: window.parent.vionikoaiChat?.userId,
    chatId: window.parent.vionikoaiChat?.chatId,
    chatName: window.parent.vionikoaiChat?.chatName,
    name: window.parent.vionikoaiChat?.name,
    email: window.parent.vionikoaiChat?.email,
    phone: window.parent.vionikoaiChat?.phone,
    fileName: window.parent.vionikoaiChat?.fileName,
  };

  try {
    previousMessages.push({ role: "user", content: userMessage });

    // Get response from proxy API
    const response = await streamFromProxyApi(userMessage);
    let accumulatedContent = "";

    // Process the stream directly
    if (!response.body) {
      throw new Error("ReadableStream not supported by browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    chatElement.classList.remove("loader");
    console.log("Beginning to read stream");

    // Process chunks as they arrive
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("Stream complete");
        break;
      }

      // Decode the chunk
      const chunk = decoder.decode(value, { stream: true });

      // Process each line in the chunk
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;

        // Try to handle prefixed format (0:, f:, etc.)
        if (line.match(/^[0fed]:/)) {
          const prefix = line.substring(0, 2);
          const content = line.substring(2);

          try {
            const parsed = JSON.parse(content);

            // Handle content chunks
            if (prefix === "0:" && typeof parsed === "string") {
              accumulatedContent += parsed;
              messageElement.textContent = accumulatedContent;
            }
          } catch (parseError) {
            console.warn(`Failed to parse ${prefix} chunk:`, content);
          }
        }
        // Handle standard SSE format
        else if (line.startsWith("data: ")) {
          try {
            if (line.includes("data: [DONE]")) {
              console.log("Received DONE signal");
              continue;
            }

            const jsonData = JSON.parse(line.substring(6));

            if (jsonData.choices && jsonData.choices[0].delta?.content) {
              const content = jsonData.choices[0].delta.content;
              accumulatedContent += content;
              messageElement.textContent = accumulatedContent;
            }
          } catch (error) {
            // Continue if parsing fails
          }
        }
        // Try to handle raw text if no specific format is detected
        else {
          try {
            // Check if it might be pure JSON
            const jsonData = JSON.parse(line);
            if (jsonData.text || jsonData.content) {
              const content = jsonData.text || jsonData.content;
              accumulatedContent += content;
              messageElement.textContent = accumulatedContent;
            }
          } catch (e) {
            // Not JSON, might be plain text
            if (line.trim()) {
              accumulatedContent += line;
              messageElement.textContent = accumulatedContent;
            }
          }
        }
      }
    }

    // Chat is complete
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
          message: userMessage,
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
  } catch (error) {
    console.error("An error occurred:", error);
    messageElement.textContent = "An error occurred. Please try again.";
  } finally {
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
