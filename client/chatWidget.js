// Warm up connections early: the chat API origin (saves DNS+TLS on the
// visitor's first message) and the font/CDN origins used below.
const addPreconnects = () => {
  const origins = [
    "https://www.chatvioniko.com",
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
    "https://cdn.jsdelivr.net",
  ];
  origins.forEach((href) => {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  });
};

// Load required stylesheets
const loadStyles = () => {
  const styles = [
    // Poppins is linked directly (not @import'd from the CSS) so the font
    // request isn't serialized behind the stylesheet download.
    "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap",
    "https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/chat.css",
    "https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/form.css",
  ];
  styles.forEach((href) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  });
};

// Generate a random ID of 17 characters
const generateRandomId = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: 17 },
    () => characters[Math.floor(Math.random() * characters.length)]
  ).join("");
};

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character]
  );

const getWidgetUiCopy = (config) => {
  const language = String(config.language || "English").toLowerCase();
  const spanish = language === "es" || language.startsWith("spanish");
  const defaults = spanish
    ? {
        open: "Abrir chat",
        close: "Cerrar chat",
        status: "En línea · Listo para ayudar",
        formTitle: "Inicia la conversación",
        formDescription:
          "Comparte tus datos para que el equipo pueda darte seguimiento.",
        continueLabel: "Continuar al chat",
        send: "Enviar mensaje",
      }
    : {
        open: "Open chat",
        close: "Close chat",
        status: "Online · Ready to help",
        formTitle: "Start the conversation",
        formDescription:
          "Share your details so the team can follow up if needed.",
        continueLabel: "Continue to chat",
        send: "Send message",
      };
  return {
    ...defaults,
    ...(config.uiText && typeof config.uiText === "object"
      ? config.uiText
      : {}),
  };
};

// Generate form fields based on window.vionikoaiChat properties
const generateFormFields = () => {
  const chatProps = window.vionikoaiChat || {};
  return ["name", "email", "phone"]
    .map((field) => {
      const fieldConfig = chatProps[field];

      // Skip if field is not configured
      if (!fieldConfig) return "";

      // Support both string (label) and object { label, required } formats
      let label, isRequired;
      if (typeof fieldConfig === "string") {
        label = fieldConfig;
        isRequired = true; // Default to required if just a string
      } else if (typeof fieldConfig === "object") {
        label = fieldConfig.label || field.charAt(0).toUpperCase() + field.slice(1);
        isRequired = fieldConfig.required !== false; // Default to required unless explicitly false
      } else {
        return "";
      }

      const inputType = field === "email" ? "email" : field === "phone" ? "tel" : "text";
      return `<div class="form-field"><label for="${field}">${escapeHtml(
        label
      )}${isRequired ? '<span aria-hidden="true">*</span>' : ""}</label><input type="${
        inputType
      }" id="${field}" name="${field}" autocomplete="${field}"${
        isRequired ? ' required aria-required="true"' : ""
      }></div>`;
    })
    .join("");
};

// Append form HTML to the chat
const appendFormHTML = () => {
  const formFields = generateFormFields();
  if (formFields) {
    const uiCopy = getWidgetUiCopy(window.vionikoaiChat || {});
    const formHTML = `<div id="form-overlay" class="form-overlay"><form id="user-form" aria-labelledby="form-title"><div class="form-intro"><span class="form-icon" aria-hidden="true">✦</span><div><h2 id="form-title">${escapeHtml(
      window.vionikoaiChat?.formTitle || uiCopy.formTitle
    )}</h2><p>${escapeHtml(
      window.vionikoaiChat?.formDescription || uiCopy.formDescription
    )}</p></div></div>${formFields}<button type="submit">${escapeHtml(
      window.vionikoaiChat?.submit || uiCopy.continueLabel
    )}<span aria-hidden="true">→</span></button></form></div>`;
    document
      .querySelector(".chat-container")
      .insertAdjacentHTML("beforeend", formHTML);
  }
};

// Show form and attach submit event
const showForm = () => {
  const form = document.getElementById("user-form");
  const chatInput = document.getElementById("textInput");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      validateForm();
    });
    chatInput.classList.add("disabled");
    chatInput.setAttribute("disabled", "disabled"); // Actually disable the input
    document.getElementById("sendButton")?.setAttribute("disabled", "disabled");
  }
};

// Validate form and hide it if valid
const validateForm = () => {
  const chatProps = window.vionikoaiChat || {};
  const chatInput = document.getElementById("textInput");

  // Get configured fields
  const configuredFields = ["name", "email", "phone"].filter(
    (field) => chatProps[field]
  );

  // Collect values only for configured fields
  const formData = {};
  let isValid = true;

  configuredFields.forEach((field) => {
    const element = document.getElementById(field);
    if (element) {
      const value = element.value?.trim();

      // Check if field is required
      const fieldConfig = chatProps[field];
      let isRequired = true;
      if (typeof fieldConfig === "object") {
        isRequired = fieldConfig.required !== false;
      }

      // Validate required fields
      if (isRequired && !value) {
        isValid = false;
      }

      // Store value if present
      if (value) {
        formData[field] = value;
      }
    }
  });

  if (isValid) {
    window.vionikoaiChat = {
      ...window.vionikoaiChat,
      chatId: window.vionikoaiChat.chatId || generateRandomId(),
      ...formData,
    };
    document.getElementById("form-overlay").style.display = "none";
    chatInput.classList.remove("disabled");
    chatInput.removeAttribute("disabled"); // Enable the input again
    document.getElementById("sendButton")?.removeAttribute("disabled");
    chatInput.focus(); // let the visitor start typing immediately
  }
};

// Initialize form
const initializeForm = () => {
  appendFormHTML();
  showForm();
};

const appendChatHTML = () => {
  const config = window.vionikoaiChat || {};
  const uiCopy = getWidgetUiCopy(config);
  const inputPlaceholder =
    config.inputPlaceholder || "Write a message...";
  const chatName = config.chatName || "Vioniko AI";
  const statusText = config.statusText || uiCopy.status;
  const firstMessage = config.firstMessage || "Hi! How can I help today?";

  const liveSupportButton = `
    <div class="live-support-container">
      <button id="live-support-button" class="live-support-button" type="button" aria-label="Open live support">
        <span aria-hidden="true">↗</span>${escapeHtml(config.supportLabel || "Contact live support")}
      </button>
      <button id="dismiss-support-button" class="dismiss-support-button" type="button" aria-label="Dismiss live support">&times;</button>
    </div>`;

  const chatHTML = `
    <div class="chat-bar-collapsible" data-widget="direct">
      <button id="chat-button" type="button" class="collapsible chat-button" aria-label="${escapeHtml(uiCopy.open)}" aria-expanded="false" aria-controls="vioniko-chat-content">
        <span class="chat-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.5 18.5 4 21l.7-3.7A8.1 8.1 0 0 1 3 12.4C3 7.8 7 4 12 4s9 3.8 9 8.4-4 8.4-9 8.4c-2 0-3.9-.6-5.5-1.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg></span>
        <span class="chat-header-copy"><strong>${escapeHtml(chatName)}</strong><small><i aria-hidden="true"></i>${escapeHtml(statusText)}</small></span>
        <span class="chat-header-action" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></span>
      </button>
      <div id="vioniko-chat-content" class="content chat-content" aria-hidden="true">
        <div id="chat-live-support" style="display: none;">
          ${config.supportType ? liveSupportButton : ""}
        </div>
        <div class="full-chat-block">
          <div class="outer-container">
            <div class="chat-container">
              <div id="chatbox" class="chatbox" role="log" aria-live="polite" aria-relevant="additions text" aria-busy="false">
                <h5 id="chat-timestamp" class="chat-timestamp" aria-label="Conversation started"></h5>
                <p id="botStarterMessage" class="botText chat-bot-message">
                  <span>${escapeHtml(firstMessage)}</span>
                </p>
              </div>
              <form id="chat-composer" class="chat-bar-input-block">
                <div id="userInput" class="user-input">
                  <label class="sr-only" for="textInput">Message</label>
                  <textarea
                    id="textInput"
                    class="input-box chat-input-box"
                    name="msg"
                    rows="1"
                    maxlength="4000"
                    placeholder="${escapeHtml(inputPlaceholder)}"
                  ></textarea>
                </div>
                <button id="sendButton" class="send-button" type="submit" aria-label="${escapeHtml(uiCopy.send)}" data-mode="send">
                  <svg class="send-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Z"/><path d="M7 12h14"/></svg>
                  <span class="stop-icon" aria-hidden="true"></span>
                </button>
              </form>
              <div class="branding">
                <a href="https://www.chatvioniko.com" target="_blank" rel="noopener noreferrer">Powered by <strong>Vioniko</strong></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", chatHTML);
};

// Load chat script
const loadChatScript = () => {
  const chatScript = document.createElement("script");
  chatScript.src =
    "https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/chat.js";
  chatScript.async = true;
  document.body.appendChild(chatScript);
};

// Load required scripts. The markdown libraries load in the background and
// must never block the widget: chat.js falls back to plain text rendering
// until they are available.
const loadScripts = () => {
  // Versions are pinned: an unpinned "latest" can ship breaking API
  // changes straight into every customer site.
  const markdownLibs = [
    "https://cdn.jsdelivr.net/npm/marked@18.0.9/lib/marked.umd.js",
    "https://cdn.jsdelivr.net/npm/dompurify@3.4.13/dist/purify.min.js",
  ];
  markdownLibs.forEach((src) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  });
  const remendLoader = document.createElement("script");
  remendLoader.type = "module";
  remendLoader.src =
    "https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/remend-loader.js";
  document.head.appendChild(remendLoader);
  loadChatScript();
  initializeForm();
};

// Attach Live Support Button
const attachLiveSupportButton = () => {
  // Add a small delay to ensure the button exists
  setTimeout(() => {
    const liveSupportButton = document.getElementById("live-support-button");
    const dismissButton = document.getElementById("dismiss-support-button");

    // Only wire the live support button when a contact is configured —
    // there is deliberately no fallback contact.
    const supportNumber = window.vionikoaiChat?.supportContact;
    if (liveSupportButton && supportNumber) {
      const supportType = (
        window.vionikoaiChat?.supportType || ""
      ).toLowerCase();

      liveSupportButton.addEventListener("click", () => {
        if (supportType === "whatsapp") {
          window.open(
            `https://api.whatsapp.com/send?phone=${supportNumber}`,
            "_blank"
          );
        } else if (supportType === "telegram") {
          window.open(`https://t.me/${supportNumber}`, "_blank");
        } else {
          window.open(`${supportNumber}`, "_blank");
        }
      });
    } else if (liveSupportButton) {
      // Misconfigured (type but no contact): keep the button hidden
      const container = document.getElementById("chat-live-support");
      if (container) container.style.display = "none";
      liveSupportButton.style.display = "none";
    }

    // Add event listener for dismiss button
    if (dismissButton) {
      dismissButton.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent triggering the live support button click
        const chatLiveSupport = document.getElementById("chat-live-support");
        if (chatLiveSupport) {
          chatLiveSupport.style.display = "none";
        }
      });
    }
  }, 100);
};

// Initialize chat
const initializeChat = () => {
  // Mint a stable per-session chat id BEFORE anything else, so EVERY embedded
  // session is captured to the owner's /history — not only sessions where a
  // lead-capture form is submitted.
  window.vionikoaiChat = window.vionikoaiChat || {};
  if (!window.vionikoaiChat.chatId) {
    window.vionikoaiChat.chatId = generateRandomId();
  }
  addPreconnects();
  loadStyles();
  appendChatHTML();
  loadScripts();
  // Call attachLiveSupportButton after a delay to ensure DOM is ready
  setTimeout(attachLiveSupportButton, 500);
};

// Initialize chat
initializeChat();
