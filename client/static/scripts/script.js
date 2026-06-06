// True while a response is streaming; blocks concurrent sends
let isGenerating = false;

// Render bot text as sanitized markdown when the libraries are available,
// falling back to plain text otherwise. User text is never rendered as
// HTML — see createChatLi.
const renderBotText = (element, text) => {
  if (window.marked && window.DOMPurify) {
    element.classList.add("md");
    element.innerHTML = window.DOMPurify.sanitize(
      window.marked.parse(text, { breaks: true }),
      // Text-only chat: no images/media (echoed user input must never
      // produce a network request), no svg/math (sanitizer bypass vectors)
      { USE_PROFILES: { html: true }, FORBID_TAGS: ["img", "svg", "math", "style"] }
    );
    // Links must not navigate the chat iframe
    element.querySelectorAll("a").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
  } else {
    element.textContent = text;
  }
};

// Keep the chatbox pinned to the bottom only while the user hasn't
// scrolled up to re-read earlier messages.
const isNearBottom = (el) =>
  el.scrollHeight - el.scrollTop - el.clientHeight < 80;
const scrollToBottom = (el) => {
  el.scrollTop = el.scrollHeight;
};

// Stream chat responses through the secure proxy API
async function streamFromProxyApi(userMessage, signal) {
  try {
    const response = await fetch("https://www.chatvioniko.com/api/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      mode: "cors",
      credentials: "omit",
      signal,
      body: JSON.stringify({
        messages: [{ role: "user", content: userMessage }],
        systemPrompt: window.parent.vionikoaiChat?.systemPrompt || "",
        conversationId: window.parent.vionikoaiChat?.conversationId,
        userId: window.parent.vionikoaiChat?.userId,
        data: {
          fileName: window.parent.vionikoaiChat?.fileName,
          chatId: window.parent.vionikoaiChat?.chatId,
        },
        // Widget identity + visitor lead fields: the server persists each
        // turn (incl. these) to the owner's /history page from onFinish.
        chatName: window.parent.vionikoaiChat?.chatName,
        name: window.parent.vionikoaiChat?.name,
        email: window.parent.vionikoaiChat?.email,
        phone: window.parent.vionikoaiChat?.phone,
        language: "English",
        origin: "embedded",
      }),
    });

    if (!response.ok) {
      throw new Error(`API responded with HTTP ${response.status}`);
    }

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
// Function to create a new chat element. Uses textContent so user input
// is never injected as HTML (XSS).
const createChatLi = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", className);
  const p = document.createElement("p");
  p.textContent = message;
  chatLi.appendChild(p);
  return chatLi;
};

// Function to generate a chat response from the server - updated to use proxy
const generateResponse = async (chatElement, userMessage) => {
  const messageElement = chatElement.querySelector("p");
  // After a few seconds, switch the loader copy (see .loader.slow in CSS)
  const slowTimer = setTimeout(() => chatElement.classList.add("slow"), 6000);

  // Abort if the stream stalls: no data at all for 45 seconds
  const controller = new AbortController();
  let watchdog = setTimeout(() => controller.abort(), 45000);
  const resetWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => controller.abort(), 45000);
  };

  isGenerating = true;
  try {
    previousMessages.push({ role: "user", content: userMessage });

    // Get response from proxy API
    const response = await streamFromProxyApi(userMessage, controller.signal);
    let accumulatedContent = "";

    // Process the stream directly
    if (!response.body) {
      throw new Error("ReadableStream not supported by browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    chatElement.classList.remove("loader", "slow");

    const renderChunk = () => {
      const stick = isNearBottom(chatbox);
      renderBotText(messageElement, accumulatedContent);
      if (stick) scrollToBottom(chatbox);
    };

    // Process chunks as they arrive
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetWatchdog();

      // Decode the chunk
      const chunk = decoder.decode(value, { stream: true });

      // Process each line in the chunk
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;

        // Prefixed format (0:, f:, etc.)
        if (line.match(/^[0fed]:/)) {
          const prefix = line.substring(0, 2);
          const content = line.substring(2);
          try {
            const parsed = JSON.parse(content);
            if (prefix === "0:" && typeof parsed === "string") {
              accumulatedContent += parsed;
              renderChunk();
            }
          } catch (parseError) {
            // Ignore malformed protocol chunks
          }
        }
        // Standard SSE format
        else if (line.startsWith("data: ")) {
          try {
            if (line.includes("data: [DONE]")) continue;
            const jsonData = JSON.parse(line.substring(6));
            // AI SDK format (text-delta)
            if (jsonData.type === "text-delta" && jsonData.delta) {
              accumulatedContent += jsonData.delta;
              renderChunk();
            }
            // OpenAI format (legacy support)
            else if (jsonData.choices && jsonData.choices[0].delta?.content) {
              accumulatedContent += jsonData.choices[0].delta.content;
              renderChunk();
            }
          } catch (error) {
            // Ignore unparseable SSE lines
          }
        }
        // Raw text fallback when no specific format is detected
        else {
          try {
            const jsonData = JSON.parse(line);
            if (jsonData.text || jsonData.content) {
              accumulatedContent += jsonData.text || jsonData.content;
              renderChunk();
            }
          } catch (e) {
            if (line.trim()) {
              accumulatedContent += line;
              renderChunk();
            }
          }
        }
      }
    }

    // Chat is complete. History (messages + lead fields) is persisted
    // server-side by /api/pdf in onFinish — the legacy client-side
    // saveChatAndWordCount calls were removed: they duplicated every turn
    // (the Cloud Function push-appends with no dedupe) and were lost
    // whenever the visitor closed the page before they fired.
    window.chatCount ? window.chatCount++ : (window.chatCount = 1);
  } catch (error) {
    console.error("An error occurred:", error);
    messageElement.textContent =
      error.name === "AbortError"
        ? "The response took too long. Please try sending your message again."
        : "An error occurred. Please try again.";
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(watchdog);
    isGenerating = false;
    previousMessages.push({
      role: "assistant",
      content: messageElement.textContent,
    });
    chatElement.classList.remove("loader", "slow");
  }
};

// ## Handle Chat
// Function to handle chat interactions
const handleChat = async (chatInput, chatbox, inputInitHeight) => {
  if (isGenerating) return; // one in-flight response at a time

  if (window.chatCount >= 3) {
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
      // Iframe content may not be accessible yet
    }
  }
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;
  chatInput.value = "";
  chatInput.style.height = `${inputInitHeight}px`;
  chatbox.appendChild(createChatLi(userMessage, "outgoing"));
  scrollToBottom(chatbox);
  const incomingChatLi = createChatLi("", "incoming");
  incomingChatLi.classList.add("loader");
  chatbox.appendChild(incomingChatLi);
  scrollToBottom(chatbox);
  await generateResponse(incomingChatLi, userMessage);
};

// ## Event Listeners
// Attach event listeners to DOM elements
document.addEventListener("DOMContentLoaded", () => {
  const vionikoid = window.parent.document.getElementById("vionikodiv");
  if (!vionikoid) {
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
  // Keyboard activation for the send control (it's a span, not a button)
  sendChatBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleChat(chatInput, chatbox, inputInitHeight);
    }
  });
  const closeChat = () => {
    document.body.classList.remove("show-chatbot");
    vionikoid.classList.toggle("closed");
  };
  closeBtn.addEventListener("click", closeChat);
  closeBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      closeChat();
    }
  });
  chatbotToggler.addEventListener("click", () => {
    document.body.classList.toggle("show-chatbot");
    vionikoid.classList.toggle("closed");
  });
});
