// True while a response is streaming; blocks concurrent sends
let isGenerating = false;
let activeController = null;

const getUiCopy = (config) => {
  const language = String(config.language || "English").toLowerCase();
  const spanish = language === "es" || language.startsWith("spanish");
  const defaults = spanish
    ? {
        open: "Abrir chat",
        close: "Cerrar chat",
        send: "Enviar mensaje",
        stop: "Detener respuesta",
        thinking: "Pensando…",
        slow: "Consultando algunos detalles…",
        timeout: "La respuesta tardó demasiado. Inténtalo de nuevo.",
        stopped: "Respuesta detenida. Puedes editar tu mensaje e intentarlo de nuevo.",
        error: "No pude completar la respuesta. Inténtalo de nuevo.",
      }
    : {
        open: "Open chat",
        close: "Close chat",
        send: "Send message",
        stop: "Stop generating response",
        thinking: "Thinking…",
        slow: "Checking a few more details…",
        timeout: "The response timed out. Please try again.",
        stopped: "Response stopped. You can edit your message and try again.",
        error: "I couldn't complete that response. Please try again.",
      };
  return {
    ...defaults,
    ...(config.uiText && typeof config.uiText === "object"
      ? config.uiText
      : {}),
  };
};

const uiCopy = getUiCopy(window.parent.vionikoaiChat || {});

// Render bot text as sanitized Markdown when the libraries are available.
// During streaming, Remend first repairs incomplete Markdown so half-written
// emphasis, links, and code fences don't make the layout jump. If any optional
// library is unavailable, streaming safely falls back to plain text.
const renderBotText = (element, text, { streaming = false } = {}) => {
  let markdown = text;
  const canRenderMarkdown =
    window.marked &&
    window.DOMPurify &&
    (!streaming || typeof window.vionikoRemend === "function");

  if (canRenderMarkdown) {
    if (streaming) {
      try {
        markdown = window.vionikoRemend(text, {
          // Never produce a temporary clickable URL while a link is partial.
          linkMode: "text-only",
          inlineKatex: false,
        });
      } catch {
        element.classList.remove("md");
        element.textContent = text;
        return;
      }
    }
    element.classList.add("md");
    element.innerHTML = window.DOMPurify.sanitize(
      window.marked.parse(markdown, { breaks: true }),
      // Text-only chat: no images/media (echoed user input must never
      // produce a network request), no svg/math (sanitizer bypass vectors),
      // and no model-controlled inline styling.
      {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["img", "svg", "math", "style"],
        FORBID_ATTR: ["style", "srcset"],
      }
    );
    // Links must not navigate the chat iframe
    element.querySelectorAll("a").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
  } else {
    element.classList.remove("md");
    element.textContent = text;
  }
};

// Coalesce fast token bursts into at most one DOM update per animation frame.
// This keeps long answers responsive while still displaying Markdown live.
const createStreamingBotRenderer = (element, afterPaint = () => {}) => {
  let frameId = null;
  let latestText = "";
  const requestFrame = window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : (callback) => setTimeout(callback, 16);
  const cancelFrame = window.cancelAnimationFrame
    ? window.cancelAnimationFrame.bind(window)
    : clearTimeout;

  const paint = () => {
    frameId = null;
    renderBotText(element, latestText, { streaming: true });
    afterPaint();
  };

  return {
    update(text) {
      latestText = text;
      if (frameId === null) frameId = requestFrame(paint);
    },
    finish(text) {
      if (frameId !== null) cancelFrame(frameId);
      frameId = null;
      latestText = text;
      renderBotText(element, text);
      afterPaint();
    },
    cancel() {
      if (frameId !== null) cancelFrame(frameId);
      frameId = null;
    },
  };
};

// Keep the chatbox pinned to the bottom only while the user hasn't
// scrolled up to re-read earlier messages.
const isNearBottom = (el) =>
  el.scrollHeight - el.scrollTop - el.clientHeight < 80;
const scrollToBottom = (el) => {
  el.scrollTop = el.scrollHeight;
};

// Only forward temperatures accepted by the model API. Embed snippets often
// provide form values as strings, so normalize a valid value to a number.
const getConfiguredTemperature = (config) => {
  const configuredValue = config?.temperature;
  if (
    configuredValue === null ||
    (typeof configuredValue === "string" && configuredValue.trim() === "") ||
    typeof configuredValue === "boolean"
  ) {
    return undefined;
  }
  const temperature = Number(configuredValue);
  return Number.isFinite(temperature) && temperature >= 0 && temperature <= 2
    ? temperature
    : undefined;
};

// Preserve structured API failures (for example ACCESS_DENIED) in the
// console instead of reducing every non-2xx response to its HTTP status.
const getApiError = async (response) => {
  let body;
  try {
    body = await response.clone().json();
  } catch {
    try {
      body = (await response.text()).trim();
    } catch {
      body = "";
    }
  }

  const details =
    typeof body === "string"
      ? body
      : [body?.error, body?.details, body?.message]
          .filter((value, index, values) =>
            value && values.indexOf(value) === index
          )
          .join(": ");

  return new Error(
    `API responded with HTTP ${response.status}${details ? `: ${details}` : ""}`
  );
};

const getStreamDelta = (payload) => {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  if (payload.type === "error") {
    throw new Error(payload.errorText || payload.error || "The response stream failed.");
  }
  if (payload.type === "text-delta") {
    return payload.delta || payload.textDelta || "";
  }
  if (typeof payload.choices?.[0]?.delta?.content === "string") {
    return payload.choices[0].delta.content;
  }
  if (typeof payload.text === "string") return payload.text;
  if (typeof payload.content === "string") return payload.content;
  return "";
};

// HTTP chunks can split in the middle of a JSON/SSE record. Buffer complete
// lines before parsing protocol streams, while rendering raw text streams as
// soon as each chunk arrives.
async function consumeChatStream(response, onText, onActivity = () => {}) {
  if (!response.body) {
    throw new Error("ReadableStream not supported by browser.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const contentType = response.headers.get("content-type") || "";
  const isProtocolStream =
    contentType.includes("text/event-stream") ||
    response.headers.get("x-vercel-ai-data-stream") === "v1" ||
    response.headers.get("x-vercel-ai-ui-message-stream") === "v1";
  let accumulated = "";
  let buffer = "";

  const append = (text) => {
    if (!text) return;
    accumulated += text;
    onText(accumulated);
  };

  const processLine = (rawLine) => {
    const line = rawLine.replace(/\r$/, "");
    if (!line.trim() || line.startsWith(":")) return;

    if (/^[0-9a-f]:/.test(line)) {
      const prefix = line.slice(0, 2);
      let payload;
      try {
        payload = JSON.parse(line.slice(2));
      } catch {
        return;
      }
      if (prefix === "3:") {
        throw new Error(
          typeof payload === "string" ? payload : "The response stream failed."
        );
      }
      if (prefix === "0:") append(getStreamDelta(payload));
      return;
    }

    if (line.startsWith("data:")) {
      const data = line.slice(5).trimStart();
      if (!data || data === "[DONE]") return;
      try {
        append(getStreamDelta(JSON.parse(data)));
      } catch (error) {
        if (error instanceof SyntaxError) return;
        throw error;
      }
      return;
    }

    try {
      append(getStreamDelta(JSON.parse(line)));
    } catch (error) {
      if (error instanceof SyntaxError) append(`${line}\n`);
      else throw error;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onActivity();
    const chunk = decoder.decode(value, { stream: true });
    if (!isProtocolStream) {
      append(chunk);
      continue;
    }
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach(processLine);
  }

  const finalChunk = decoder.decode();
  if (isProtocolStream) {
    buffer += finalChunk;
    if (buffer) processLine(buffer);
  } else {
    append(finalChunk);
  }
  return accumulated;
}

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
        embedToken: window.parent.vionikoaiChat?.embedToken,
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
        temperature: getConfiguredTemperature(window.parent.vionikoaiChat),
        language: window.parent.vionikoaiChat?.language || "English",
        origin: "embedded",
      }),
    });

    if (!response.ok) {
      throw await getApiError(response);
    }

    return response; // Return the full response
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error streaming chat response:", error);
    }
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
const sendChatBtn = document.querySelector("#send-btn");
const inputInitHeight = 44;

const setGeneratingState = (generating) => {
  isGenerating = generating;
  chatInput.disabled = generating;
  sendChatBtn.dataset.mode = generating ? "stop" : "send";
  sendChatBtn.setAttribute(
    "aria-label",
    generating ? uiCopy.stop : uiCopy.send
  );
  chatbox.setAttribute("aria-busy", String(generating));
};

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
  let shouldStickToBottom = true;
  const streamingRenderer = createStreamingBotRenderer(messageElement, () => {
    if (shouldStickToBottom) scrollToBottom(chatbox);
  });
  messageElement.textContent = uiCopy.thinking;
  // After a few seconds, switch the loader copy (see .loader.slow in CSS)
  const slowTimer = setTimeout(() => {
    if (chatElement.classList.contains("loader")) {
      chatElement.classList.add("slow");
      messageElement.textContent = uiCopy.slow;
    }
  }, 6000);

  // Abort if the stream stalls: no data at all for 45 seconds
  const controller = new AbortController();
  activeController = controller;
  let timedOut = false;
  const abortForTimeout = () => {
    timedOut = true;
    controller.abort();
  };
  let watchdog = setTimeout(abortForTimeout, 45000);
  const resetWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(abortForTimeout, 45000);
  };

  setGeneratingState(true);
  let accumulatedContent = "";
  try {
    previousMessages.push({ role: "user", content: userMessage });

    // Get response from proxy API
    const response = await streamFromProxyApi(userMessage, controller.signal);
    accumulatedContent = await consumeChatStream(response, (text) => {
      chatElement.classList.remove("loader", "slow");
      shouldStickToBottom = isNearBottom(chatbox);
      messageElement.classList.add("streaming");
      streamingRenderer.update(text);
    }, resetWatchdog);

    if (!accumulatedContent.trim()) {
      throw new Error("The response stream ended without content.");
    }
    messageElement.classList.remove("streaming");
    streamingRenderer.finish(accumulatedContent);

    // Chat is complete. History (messages + lead fields) is persisted
    // server-side by /api/pdf in onFinish — the legacy client-side
    // saveChatAndWordCount calls were removed: they duplicated every turn
    // (the Cloud Function push-appends with no dedupe) and were lost
    // whenever the visitor closed the page before they fired.
    window.chatCount ? window.chatCount++ : (window.chatCount = 1);
  } catch (error) {
    streamingRenderer.cancel();
    if (error.name !== "AbortError") {
      console.error("An error occurred:", error);
    }
    chatElement.classList.add("error");
    messageElement.classList.remove("streaming", "md");
    if (error.name === "AbortError" && !timedOut) {
      chatInput.value = userMessage;
      chatInput.style.height = `${Math.min(chatInput.scrollHeight, 116)}px`;
    }
    messageElement.textContent =
      error.name === "AbortError"
        ? timedOut
          ? uiCopy.timeout
          : uiCopy.stopped
        : uiCopy.error;
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(watchdog);
    if (activeController === controller) activeController = null;
    setGeneratingState(false);
    previousMessages.push({
      role: "assistant",
      content: messageElement.textContent,
    });
    chatElement.classList.remove("loader", "slow");
    chatInput.focus();
  }
};

// ## Handle Chat
// Function to handle chat interactions
const handleChat = async (chatInput, chatbox, inputInitHeight) => {
  if (isGenerating) {
    activeController?.abort();
    return;
  }

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
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 116)}px`;
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChat(chatInput, chatbox, inputInitHeight);
    }
  });

  document.querySelector(".chat-input").addEventListener("submit", (e) => {
    e.preventDefault();
    handleChat(chatInput, chatbox, inputInitHeight);
  });
  const closeChat = () => {
    document.body.classList.remove("show-chatbot");
    vionikoid.classList.add("closed");
    chatbotToggler.setAttribute("aria-expanded", "false");
    chatbotToggler.setAttribute("aria-label", uiCopy.open);
  };
  closeBtn.addEventListener("click", closeChat);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("show-chatbot")) {
      closeChat();
      chatbotToggler.focus();
    }
  });
});
