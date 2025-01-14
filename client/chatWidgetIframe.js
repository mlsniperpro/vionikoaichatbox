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
      const label = chatProps[field]
        ? chatProps[field]
        : field.charAt(0).toUpperCase() + field.slice(1);
      return chatProps[field]
        ? `<label for="${field}">${label}:</label><input type="${
            field === "email" ? "email" : "text"
          }" id="${field}" name="${field}" required>`
        : "";
    })
    .join("");
};

// Validate form and hide it if valid, then open chatbox
const validateForm = (iframe) => {
  const doc = iframe.contentWindow.document;
  const name = doc.getElementById("name")?.value;
  const email = doc.getElementById("email")?.value;
  const phone = doc.getElementById("phone")?.value;
  if (name && email && phone) {
    window.parent.vionikoaiChat = {
      ...window.parent.vionikoaiChat,
      chatId: generateRandomId(),
      name,
      email,
      phone,
    };
    doc.getElementById("form-overlay").style.display = "none";
    const chatbot = doc.querySelector(".chatbot");
    chatbot.style.display = "block";
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
  iframe.setAttribute("title", "Vionikaio Chat");

  const formFields = generateFormFields();
  const liveSupportButtonHTML = `
    <div id="live-support-container" class="live-support-container">
      <button id="live-support-button" class="live-support-button">
        ${window?.parent?.vionikoaiChat?.supportLabel || "Live Support"}
      </button>
      <button id="dismiss-live-support" class="dismiss-live-support">&times;</button>
    </div>
  `;

  const srcDocContent = `
  <html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
    <title>Chatbot in JavaScript | CodingNepal</title>
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/style.css">
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/form.css">
    <style>
      /* Import Google font - Poppins */
      @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: "Poppins", sans-serif;
      }

      .live-support-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        display: none;
        z-index: 1000;
        font-family: "Poppins", sans-serif;
      }

      #live-support-button {
        background-color: #724ae8;
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
        background-color: #5f3cc6;
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
    </style>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@48,400,1,0" />
    <script src="https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/script.js" defer></script>
  </head>
  <body>
  <button class="chatbot-toggler">
      <span class="material-symbols-rounded">mode_comment</span>
      <span class="material-symbols-outlined">close</span>
    </button>
    <div class="chatbot-container">
      ${window.parent.vionikoaiChat.supportType && liveSupportButtonHTML}
      <div class="chatbot">
        <header>
          <h2>${window.parent.vionikoaiChat?.chatName || "VionikoAI Chat"}</h2>
          <span class="close-btn material-symbols-outlined" style="cursor: pointer; transition: opacity 0.2s ease;">close</span>
        </header>
        <ul class="chatbox">
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
          <span id="send-btn" class="material-symbols-rounded" style="color: #724ae8; transition: transform 0.2s ease;">send</span>
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
    const supportNumber =
      window.parent.vionikoaiChat.supportContact || "15035833307"; // Replace with your actual support number

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        validateForm(iframe);
      });
    }

    if (chatbotToggler) {
      chatbotToggler.addEventListener("click", () => {
        if (formOverlay.style.display === "block") {
          formOverlay.style.display = "none";
          chatbot.style.display = "none";
        } else {
          formOverlay.style.display = "block";
          chatbot.style.display = "none";
        }
      });
    }

    if (liveSupportButton) {
      liveSupportButton.addEventListener("click", () => {
        if (window.parent.vionikoaiChat.supportType === "whatsapp") {
          window.parent.open(
            `https://api.whatsapp.com/send?phone=${supportNumber}`,
            "_blank"
          );
        } else if (window.parent.vionikoaiChat.supportType === "telegram") {
          window.parent.open(`https://t.me/${supportNumber}`, "_blank");
        } else {
          window.parent.open(`${supportNumber}`, "_blank");
        }
      });
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
