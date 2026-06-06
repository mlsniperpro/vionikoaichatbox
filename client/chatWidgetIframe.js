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

      return `<label for="${field}">${label}:</label><input type="${
        field === "email" ? "email" : "text"
      }" id="${field}" name="${field}"${isRequired ? " required" : ""}>`;
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
      chatId: generateRandomId(),
      ...formData,
    };
    doc.getElementById("form-overlay").style.display = "none";
    const chatbot = doc.querySelector(".chatbot");
    chatbot.style.display = "block";
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
  const liveSupportButtonHTML = `
    <div id="live-support-container" class="live-support-container">
      <button id="live-support-button" class="live-support-button">
        ${window?.parent?.vionikoaiChat?.supportLabel || "Live Support"}
      </button>
      <button id="dismiss-live-support" class="dismiss-live-support">&times;</button>
    </div>
  `;
  // Check if supportType exists and is not null before including it in the HTML
  const shouldShowSupportButton =
    window?.parent?.vionikoaiChat?.supportType &&
    window.parent.vionikoaiChat.supportType !== "null";

  const srcDocContent = `
  <html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
    <title>${window.parent.vionikoaiChat?.chatName || "Vioniko Chat"}</title>
    <!-- Warm up the chat API origin so the first message skips DNS+TLS -->
    <link rel="preconnect" href="https://www.chatvioniko.com" crossorigin>
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <!-- Poppins linked directly so the font isn't serialized behind the stylesheet -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap">
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/style.css">
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/form.css">
    <style>
      /* Font is imported via style.css */

      .live-support-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: none;
        z-index: 1000;
        font-family: "Poppins", sans-serif;
      }

      #live-support-button {
        background-color: #ff0000;
        color: white;
        padding: 12px 24px;
        font-size: 0.95rem;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 500;
        box-shadow: 0 0 128px 0 rgba(0,0,0,0.1),
                    0 32px 64px -48px rgba(0,0,0,0.5);
        transition: transform 0.2s ease, background-color 0.2s ease;
      }

      #live-support-button:hover {
        background-color: #cc0000;
        transform: translateY(-2px);
      }

      .dismiss-live-support {
        background: #724ae8;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        position: absolute;
        top: -10px;
        right: -10px;
        width: 24px;
        height: 24px;
        border-radius: 12px;
        text-align: center;
        line-height: 24px;
        transition: background-color 0.2s ease;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      }

      .dismiss-live-support:hover {
        background-color: #5f3cc6;
      }

      /* Ensure Material Icons load properly */
      .material-symbols-outlined,
      .material-symbols-rounded {
        font-family: 'Material Symbols Outlined', 'Material Symbols Rounded';
        font-weight: normal;
        font-style: normal;
        font-size: 24px;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        -moz-osx-font-smoothing: grayscale;
      }
    </style>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@48,400,1,0" />
    <!-- Markdown libs load async and never block the chat; script.js falls
         back to plain text rendering until they are available -->
    <script src="https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js" async></script>
    <script src="https://cdn.jsdelivr.net/npm/dompurify@3.4.8/dist/purify.min.js" async></script>
    <script src="https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/script.js" defer></script>
  </head>
  <body>
  <button class="chatbot-toggler" aria-label="Open chat">
      <span class="material-symbols-rounded" aria-hidden="true">mode_comment</span>
      <span class="material-symbols-outlined" aria-hidden="true">close</span>
    </button>
    <div class="chatbot-container">
      ${shouldShowSupportButton ? liveSupportButtonHTML : ""}
      <div class="chatbot">
        <header>
          <h2>${window.parent.vionikoaiChat?.chatName || "VionikoAI Chat"}</h2>
          <span class="close-btn material-symbols-outlined" role="button" tabindex="0" aria-label="Close chat" style="cursor: pointer; transition: opacity 0.2s ease;">close</span>
        </header>
        <ul class="chatbox" role="log" aria-live="polite">
          <!-- Chat messages will be appended here -->
        </ul>
        <div class="chat-input">
          <textarea
            placeholder="${
              window.parent.vionikoaiChat?.inputPlaceholder ||
              "Type a message..."
            }"
            spellcheck="false"
            required
            style="font-family: 'Poppins', sans-serif; font-size: 0.95rem;"
          ></textarea>
          <span id="send-btn" class="material-symbols-rounded" role="button" tabindex="0" aria-label="Send message" style="color: #724ae8; transition: transform 0.2s ease;">send</span>
        </div>
        <div class="branding">
          <a href="https://www.chatvioniko.com" target="_blank" rel="noopener noreferrer">Powered by Vioniko</a>
        </div>
      </div>
      <div id="form-overlay" class="form-overlay" style="display:none; z-index: 9999999999;">
        <form id="user-form">${formFields}<input type="submit" value="${
    window.parent.vionikoaiChat?.submit || "Submit"
  }"></form>
      </div>
    </div>
  </body>
</html>
  `;

  iDiv.appendChild(iframe);
  iframe.srcdoc = srcDocContent;
  iframe.style.width = "100%";
  iframe.style.height = "100%";

  // Attach form submit event and live support button event
  iframe.onload = () => {
    const doc = iframe.contentWindow.document;
    const form = doc.getElementById("user-form");
    const chatbotToggler = doc.querySelector(".chatbot-toggler");
    const formOverlay = doc.getElementById("form-overlay");
    const chatbot = doc.querySelector(".chatbot");
    const liveSupportButton = doc.getElementById("live-support-button");
    const dismissButton = doc.getElementById("dismiss-live-support");
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
        // Check if form has any input fields (excluding submit button)
        const hasFormFields = formOverlay.querySelector('input:not([type="submit"])');

        if (formOverlay.style.display === "block") {
          formOverlay.style.display = "none";
          chatbot.style.display = "none";
        } else {
          // Only show form if it has fields, otherwise show chat directly
          if (hasFormFields) {
            formOverlay.style.display = "block";
            chatbot.style.display = "none";
            // Focus the first form field so the visitor can type right away
            formOverlay.querySelector('input:not([type="submit"])')?.focus();
          } else {
            chatbot.style.display = "block";
            doc.querySelector(".chat-input textarea")?.focus();
          }
        }
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
