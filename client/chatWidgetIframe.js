// Function to check if the document is ready
function ready(callbackFunction) {
  if (document.readyState !== "loading") {
    callbackFunction();
  } else {
    document.addEventListener("DOMContentLoaded", callbackFunction);
  }
}

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

const getLanguageCode = (language) => {
  const normalized = String(language || "English").toLowerCase();
  const knownLanguages = {
    english: "en",
    spanish: "es",
    portuguese: "pt",
    french: "fr",
    german: "de",
    italian: "it",
  };
  return knownLanguages[normalized] || normalized.slice(0, 2) || "en";
};

const getUiCopy = (config) => {
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
  const chatProps = window.parent.vionikoaiChat || {};
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

// Validate form and hide it if valid, then open chatbox
const validateForm = (iframe) => {
  const doc = iframe.contentWindow.document;
  const chatProps = window.parent.vionikoaiChat || {};

  // Get configured fields
  const configuredFields = ["name", "email", "phone"].filter(
    (field) => chatProps[field]
  );

  // Collect values only for configured fields
  const formData = {};
  let isValid = true;

  configuredFields.forEach((field) => {
    const element = doc.getElementById(field);
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
    window.parent.vionikoaiChat = {
      ...window.parent.vionikoaiChat,
      chatId: window.parent.vionikoaiChat.chatId || generateRandomId(),
      ...formData,
    };
    doc.getElementById("form-overlay").style.display = "none";
    doc.getElementById("user-form").dataset.completed = "true";
    const chatbot = doc.querySelector(".chatbot");
    chatbot.style.display = "flex";
    // Let the visitor start typing immediately
    doc.querySelector(".chat-input textarea")?.focus();
  }
};

// Load iframe with form and chat
function loadIframe() {
  let containerDiv = document.createElement("div");
  containerDiv.setAttribute("id", "container");
  document.body.appendChild(containerDiv);

  const iDiv = document.createElement("div");
  iDiv.setAttribute("id", "vionikodiv");
  iDiv.classList.add("closed");
  containerDiv.appendChild(iDiv);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("border", "0");
  iframe.setAttribute(
    "title",
    window?.parent?.vionikoaiChat?.chatName || "Vioniko Chat"
  );

  const formFields = generateFormFields();
  const config = window.parent.vionikoaiChat || {};
  const uiCopy = getUiCopy(config);
  const chatName = config.chatName || "Vioniko AI";
  const statusText = config.statusText || uiCopy.status;
  const firstMessage = config.firstMessage || "Hi! How can I help today?";
  const inputPlaceholder = config.inputPlaceholder || "Write a message...";
  const liveSupportButtonHTML = `
    <div id="live-support-container" class="live-support-container">
      <button id="live-support-button" class="live-support-button" type="button">
        <span aria-hidden="true">↗</span>${escapeHtml(config.supportLabel || "Contact live support")}
      </button>
      <button id="dismiss-live-support" class="dismiss-live-support" type="button" aria-label="Dismiss live support">&times;</button>
    </div>
  `;
  // Check if supportType exists and is not null before including it in the HTML
  const shouldShowSupportButton =
    window?.parent?.vionikoaiChat?.supportType &&
    window.parent.vionikoaiChat.supportType !== "null";

  const srcDocContent = `
  <html lang="${getLanguageCode(config.language)}" dir="ltr">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(chatName)}</title>
    <!-- Warm up the chat API origin so the first message skips DNS+TLS -->
    <link rel="preconnect" href="https://www.chatvioniko.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <!-- Poppins linked directly so the font isn't serialized behind the stylesheet -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap">
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/style.css">
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/form.css">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Markdown libs load async and never block the chat; script.js falls
         back to plain text rendering until they are available -->
    <script src="https://cdn.jsdelivr.net/npm/marked@18.0.9/lib/marked.umd.js" async></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.4.13/dist/purify.min.js" async></script>
    <script type="module" src="https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/remend-loader.js"></script>
    <script src="https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/script.js" defer></script>
  </head>
  <body>
  <button class="chatbot-toggler" type="button" aria-label="${escapeHtml(uiCopy.open)}" aria-expanded="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 18.5 4 21l.7-3.7A8.1 8.1 0 0 1 3 12.4C3 7.8 7 4 12 4s9 3.8 9 8.4-4 8.4-9 8.4c-2 0-3.9-.6-5.5-1.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>
    </button>
    <div class="chatbot-container">
      ${shouldShowSupportButton ? liveSupportButtonHTML : ""}
      <div class="chatbot">
        <header>
          <span class="chat-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.5 18.5 4 21l.7-3.7A8.1 8.1 0 0 1 3 12.4C3 7.8 7 4 12 4s9 3.8 9 8.4-4 8.4-9 8.4c-2 0-3.9-.6-5.5-1.5Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg></span>
          <div class="chat-header-copy"><h2>${escapeHtml(chatName)}</h2><p><i aria-hidden="true"></i>${escapeHtml(statusText)}</p></div>
          <button class="close-btn" type="button" aria-label="${escapeHtml(uiCopy.close)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
        </header>
        <ul class="chatbox" role="log" aria-live="polite" aria-relevant="additions text" aria-busy="false">
          <li class="chat incoming welcome-message"><p>${escapeHtml(firstMessage)}</p></li>
        </ul>
        <form class="chat-input">
          <label class="sr-only" for="chat-message">Message</label>
          <textarea
            id="chat-message"
            rows="1"
            placeholder="${escapeHtml(inputPlaceholder)}"
            spellcheck="true"
            maxlength="4000"
            required
          ></textarea>
          <button id="send-btn" type="submit" aria-label="${escapeHtml(uiCopy.send)}" data-mode="send"><svg class="send-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Z"/><path d="M7 12h14"/></svg><span class="stop-icon" aria-hidden="true"></span></button>
        </form>
        <div class="branding">
          <a href="https://www.chatvioniko.com" target="_blank" rel="noopener noreferrer">Powered by <strong>Vioniko</strong></a>
        </div>
      </div>
      <div id="form-overlay" class="form-overlay" style="display:none;">
        <form id="user-form" aria-labelledby="form-title"><button class="form-close" type="button" aria-label="${escapeHtml(uiCopy.close)}">&times;</button><div class="form-intro"><span class="form-icon" aria-hidden="true">✦</span><div><h2 id="form-title">${escapeHtml(
          config.formTitle || uiCopy.formTitle
        )}</h2><p>${escapeHtml(
          config.formDescription || uiCopy.formDescription
        )}</p></div></div>${formFields}<button type="submit">${escapeHtml(
          config.submit || uiCopy.continueLabel
        )}<span aria-hidden="true">→</span></button></form>
      </div>
    </div>
  </body>
</html>
  `;

  iDiv.appendChild(iframe);
  iframe.srcdoc = srcDocContent;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";

  // Attach form submit event and live support button event
  iframe.onload = () => {
    const doc = iframe.contentWindow.document;
    const form = doc.getElementById("user-form");
    const chatbotToggler = doc.querySelector(".chatbot-toggler");
    const formOverlay = doc.getElementById("form-overlay");
    const chatbot = doc.querySelector(".chatbot");
    const liveSupportButton = doc.getElementById("live-support-button");
    const dismissButton = doc.getElementById("dismiss-live-support");
    const formCloseButton = doc.querySelector(".form-close");
    // No fallback contact: if none is configured, the button stays inert/hidden
    const supportNumber = window.parent.vionikoaiChat?.supportContact;
    const supportType = (
      window.parent.vionikoaiChat?.supportType || ""
    ).toLowerCase();

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        validateForm(iframe);
      });
    }

    if (chatbotToggler) {
      chatbotToggler.addEventListener("click", () => {
        const opening = iDiv.classList.contains("closed");
        iDiv.classList.toggle("closed", !opening);
        doc.body.classList.toggle("show-chatbot", opening);
        chatbotToggler.setAttribute("aria-expanded", String(opening));
        chatbotToggler.setAttribute(
          "aria-label",
          opening ? uiCopy.close : uiCopy.open
        );

        if (!opening) {
          formOverlay.style.display = "none";
          return;
        }

        const hasFormFields = formOverlay.querySelector('input:not([type="submit"])');
        const needsLeadForm = hasFormFields && form?.dataset.completed !== "true";
        if (needsLeadForm) {
          formOverlay.style.display = "flex";
          chatbot.style.display = "none";
          formOverlay.querySelector('input:not([type="submit"])')?.focus();
        } else {
          formOverlay.style.display = "none";
          chatbot.style.display = "flex";
          doc.querySelector(".chat-input textarea")?.focus();
        }
      });
    }

    if (formCloseButton) {
      formCloseButton.addEventListener("click", () => {
        formOverlay.style.display = "none";
        doc.body.classList.remove("show-chatbot");
        iDiv.classList.add("closed");
        chatbotToggler.setAttribute("aria-expanded", "false");
        chatbotToggler.setAttribute("aria-label", uiCopy.open);
      });
    }

    if (liveSupportButton && supportNumber) {
      liveSupportButton.addEventListener("click", () => {
        if (supportType === "whatsapp") {
          window.parent.open(
            `https://api.whatsapp.com/send?phone=${supportNumber}`,
            "_blank"
          );
        } else if (supportType === "telegram") {
          window.parent.open(`https://t.me/${supportNumber}`, "_blank");
        } else {
          window.parent.open(`${supportNumber}`, "_blank");
        }
      });
    } else if (liveSupportButton) {
      // Misconfigured (type but no contact): never show the button
      const container = doc.getElementById("live-support-container");
      if (container) container.style.display = "none";
    }

    if (dismissButton) {
      dismissButton.addEventListener("click", () => {
        const liveSupportContainer = doc.getElementById(
          "live-support-container"
        );
        liveSupportContainer.style.display = "none";
      });
    }
  };
}

// Initialize the widget
function initWidget() {
  // Mint a stable per-session chat id on window.parent (the inner script.js
  // reads window.parent.vionikoaiChat), so EVERY embedded session is captured
  // to the owner's /history — not only sessions where a form is submitted.
  window.parent.vionikoaiChat = window.parent.vionikoaiChat || {};
  if (!window.parent.vionikoaiChat.chatId) {
    window.parent.vionikoaiChat.chatId = generateRandomId();
  }
  initCSSWidget();
  loadIframe();
}

// Initialize CSS for the widget
function initCSSWidget() {
  const iframeCSSLink = document.createElement("link");
  iframeCSSLink.id = "iframeCss";
  iframeCSSLink.rel = "stylesheet";
  iframeCSSLink.type = "text/css";
  iframeCSSLink.href =
    "https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/iframe.css";
  iframeCSSLink.media = "all";
  document.head.appendChild(iframeCSSLink);
}

// Ready function to initialize widget
ready(function () {
  initWidget();
});
