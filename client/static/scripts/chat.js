// Initialize messages array with just the system prompt
const previousMessages = [
  {
    role: "system",
    content: window.vionikoaiChat?.systemPrompt || "",
  },
];

// True while a response is streaming; blocks concurrent sends
let isGenerating = false;

// Render bot text as sanitized markdown when the libraries are available,
// falling back to plain text otherwise. User text is never rendered as
// HTML — see appendMessage.
const renderBotText = (element, text) => {
  if (window.marked && window.DOMPurify) {
    element.classList.add("md");
    element.innerHTML = window.DOMPurify.sanitize(
      window.marked.parse(text, { breaks: true }),
      // Text-only chat: no images/media (echoed user input must never
      // produce a network request), no svg/math (sanitizer bypass vectors)
      { USE_PROFILES: { html: true }, FORBID_TAGS: ["img", "svg", "math", "style"] }
    );
    // Links must not navigate the embedding page
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

// Function to append messages to the chatbox. Uses textContent so user
// input is never injected as HTML (XSS).
const appendMessage = (message, type) => {
  const chatbox = document.getElementById("chatbox");
  const stick = isNearBottom(chatbox);
  const p = document.createElement("p");
  p.className = `${type}Text`;
  const span = document.createElement("span");
  span.textContent = message;
  p.appendChild(span);
  chatbox.appendChild(p);
  if (stick) scrollToBottom(chatbox);
  return p;
};

// Function to get the current time in HH:MM format
const getTime = () => {
  return `${new Date().getHours().toString().padStart(2, "0")}:${new Date()
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
};

// Function to stream chat responses from PDF API
async function streamFromPDFApi(input, signal) {
  try {
    const requestBody = {
      messages: [{ role: "user", content: input }],
      systemPrompt: window.vionikoaiChat?.systemPrompt || "",
      conversationId: window.vionikoaiChat?.conversationId,
      userId: window.vionikoaiChat?.userId,
      data: {
        fileName: window.vionikoaiChat?.fileName,
        chatId: window.vionikoaiChat?.chatId,
      },
      // Widget identity + visitor lead fields: the server persists each turn
      // (incl. these) to the owner's /history page from onFinish.
      chatName: window.vionikoaiChat?.chatName,
      name: window.vionikoaiChat?.name,
      email: window.vionikoaiChat?.email,
      phone: window.vionikoaiChat?.phone,
      language: "English",
      origin: "embedded",
    };
    const response = await fetch("https://www.chatvioniko.com/api/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      mode: "cors",
      credentials: "omit",
      signal,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`API responded with HTTP ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error("Error streaming chat response:", error);
    throw error;
  }
}

// Collapsible event listener
document.addEventListener("click", (e) => {
  for (let t = e.target; t; t = t.parentElement) {
    if (t.classList.contains("collapsible")) {
      t.classList.toggle("active");
      const c = t.nextElementSibling;
      const opening = !c.style.maxHeight;
      c.style.maxHeight = opening ? `${c.scrollHeight}px` : null;
      if (opening) {
        // Let the visitor start typing immediately (unless the lead
        // form still gates the input)
        const input = document.getElementById("textInput");
        if (input && !input.disabled) input.focus();
      }
      return;
    }
  }
});

// Text input event listener
document.getElementById("textInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    getResponse();
  }
});

// Initialize the chatbox with the first bot message
const firstBotMessage = () => {
  const starter = document.getElementById("botStarterMessage");
  starter.textContent = "";
  const span = document.createElement("span");
  span.textContent = window.vionikoaiChat?.firstMessage || "Say Something...";
  starter.appendChild(span);
  document.getElementById("chat-timestamp").append(getTime());
};

// Function to get bot response
const getResponse = async () => {
  if (isGenerating) return; // one in-flight response at a time
  const inputEl = document.getElementById("textInput");
  const userText = inputEl.value.trim();
  if (!userText) return;

  if (window.chatCount >= 3) {
    const liveSupport = document.getElementById("chat-live-support");
    if (liveSupport && liveSupport.style.display !== "block") {
      liveSupport.style.display = "block";
    }
  }

  appendMessage(userText, "user");
  inputEl.value = "";
  await getBotResponse(userText);
};

// Get the bot response from the PDF API, streaming it into the chatbox
async function getBotResponse(input) {
  const chatbox = document.getElementById("chatbox");
  const botMessage = appendMessage("", "bot");
  const messageSpan = botMessage.querySelector("span");
  botMessage.classList.add("loader");
  // After a few seconds, switch the loader copy (see .loader.slow in CSS)
  const slowTimer = setTimeout(() => botMessage.classList.add("slow"), 6000);

  // Abort if the stream stalls: no data at all for 45 seconds
  const controller = new AbortController();
  let watchdog = setTimeout(() => controller.abort(), 45000);
  const resetWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => controller.abort(), 45000);
  };

  isGenerating = true;
  try {
    previousMessages.push({ role: "user", content: input });

    const response = await streamFromPDFApi(input, controller.signal);
    let accumulatedContent = "";

    if (!response.body) {
      throw new Error("ReadableStream not supported by browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    botMessage.classList.remove("loader", "slow");

    const renderChunk = () => {
      const stick = isNearBottom(chatbox);
      renderBotText(messageSpan, accumulatedContent);
      if (stick) scrollToBottom(chatbox);
    };

    // Process chunks as they arrive
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetWatchdog();

      const chunk = decoder.decode(value, { stream: true });
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

    // Add the assistant's response to previous messages
    previousMessages.push({
      role: "assistant",
      content: accumulatedContent,
    });

    // Chat is complete. History (messages + lead fields) is persisted
    // server-side by /api/pdf in onFinish — the legacy client-side
    // saveChatAndWordCount calls were removed: they duplicated every turn
    // (the Cloud Function push-appends with no dedupe) and were lost
    // whenever the visitor closed the page before they fired.
    window.chatCount ? window.chatCount++ : (window.chatCount = 1);
  } catch (error) {
    console.error("Error in getBotResponse:", error);
    botMessage.classList.remove("loader", "slow");
    messageSpan.textContent =
      error.name === "AbortError"
        ? "The response took too long. Please try sending your message again."
        : "An error occurred. Please try again later.";

    // If there's an error, we should still add the error message to the history
    previousMessages.push({
      role: "assistant",
      content: messageSpan.textContent,
    });
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(watchdog);
    isGenerating = false;
  }
}

// Initialize the chat
firstBotMessage();
