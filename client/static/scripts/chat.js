// Initialize messages array with just the system prompt
const previousMessages = [
  {
    role: "system",
    content: window.vionikoaiChat?.systemPrompt || "",
  },
];

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

const uiCopy = getUiCopy(window.vionikoaiChat || {});

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
    // Links must not navigate the embedding page
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
      embedToken: window.vionikoaiChat?.embedToken,
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
      temperature: getConfiguredTemperature(window.vionikoaiChat),
      language: window.vionikoaiChat?.language || "English",
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
      throw await getApiError(response);
    }

    return response;
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Error streaming chat response:", error);
    }
    throw error;
  }
}

const setWidgetOpen = (button, opening) => {
  const widget = button.closest(".chat-bar-collapsible");
  widget.classList.toggle("is-open", opening);
  button.classList.toggle("active", opening);
  button.setAttribute("aria-expanded", String(opening));
  button.setAttribute("aria-label", opening ? uiCopy.close : uiCopy.open);
  button.nextElementSibling.setAttribute("aria-hidden", String(!opening));
};

// Collapsible event listener
document.addEventListener("click", (e) => {
  for (let t = e.target; t; t = t.parentElement) {
    if (t.classList.contains("collapsible")) {
      const widget = t.closest(".chat-bar-collapsible");
      const opening = !widget.classList.contains("is-open");
      setWidgetOpen(t, opening);
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
document.addEventListener("keydown", (e) => {
  const button = document.getElementById("chat-button");
  if (
    e.key === "Escape" &&
    button.getAttribute("aria-expanded") === "true"
  ) {
    setWidgetOpen(button, false);
    button.focus();
  }
});

// Text input event listener
const messageInput = document.getElementById("textInput");
const resizeMessageInput = () => {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 116)}px`;
};
messageInput.addEventListener("input", resizeMessageInput);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    getResponse();
  }
});
document.getElementById("chat-composer").addEventListener("submit", (e) => {
  e.preventDefault();
  getResponse();
});

const setGeneratingState = (generating) => {
  isGenerating = generating;
  const input = document.getElementById("textInput");
  const sendButton = document.getElementById("sendButton");
  const chatbox = document.getElementById("chatbox");
  input.disabled = generating;
  sendButton.dataset.mode = generating ? "stop" : "send";
  sendButton.setAttribute(
    "aria-label",
    generating ? uiCopy.stop : uiCopy.send
  );
  chatbox.setAttribute("aria-busy", String(generating));
};

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
  if (isGenerating) {
    activeController?.abort();
    return;
  }
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
  resizeMessageInput();
  await getBotResponse(userText);
};

// Get the bot response from the PDF API, streaming it into the chatbox
async function getBotResponse(input) {
  const chatbox = document.getElementById("chatbox");
  const botMessage = appendMessage("", "bot");
  const messageSpan = botMessage.querySelector("span");
  let shouldStickToBottom = true;
  const streamingRenderer = createStreamingBotRenderer(messageSpan, () => {
    if (shouldStickToBottom) scrollToBottom(chatbox);
  });
  messageSpan.textContent = uiCopy.thinking;
  botMessage.classList.add("loader");
  // After a few seconds, switch the loader copy (see .loader.slow in CSS)
  const slowTimer = setTimeout(() => {
    if (botMessage.classList.contains("loader")) {
      botMessage.classList.add("slow");
      messageSpan.textContent = uiCopy.slow;
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
    previousMessages.push({ role: "user", content: input });

    const response = await streamFromPDFApi(input, controller.signal);
    accumulatedContent = await consumeChatStream(response, (text) => {
      botMessage.classList.remove("loader", "slow");
      shouldStickToBottom = isNearBottom(chatbox);
      messageSpan.classList.add("streaming");
      streamingRenderer.update(text);
    }, resetWatchdog);

    if (!accumulatedContent.trim()) {
      throw new Error("The response stream ended without content.");
    }
    messageSpan.classList.remove("streaming");
    streamingRenderer.finish(accumulatedContent);

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
    streamingRenderer.cancel();
    if (error.name !== "AbortError") {
      console.error("Error in getBotResponse:", error);
    }
    botMessage.classList.remove("loader", "slow");
    botMessage.classList.add("error");
    messageSpan.classList.remove("streaming", "md");
    if (error.name === "AbortError" && !timedOut) {
      document.getElementById("textInput").value = input;
      resizeMessageInput();
    }
    messageSpan.textContent =
      error.name === "AbortError"
        ? timedOut
          ? uiCopy.timeout
          : uiCopy.stopped
        : uiCopy.error;

    // If there's an error, we should still add the error message to the history
    previousMessages.push({
      role: "assistant",
      content: messageSpan.textContent,
    });
  } finally {
    clearTimeout(slowTimer);
    clearTimeout(watchdog);
    if (activeController === controller) activeController = null;
    setGeneratingState(false);
    document.getElementById("textInput").focus();
  }
}

// Initialize the chat
firstBotMessage();
