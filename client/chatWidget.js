// Load required stylesheets
const loadStyles = () => {
  const styles = [
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

// Generate form fields based on window.vionikoaiChat properties
const generateFormFields = () => {
  const chatProps = window.vionikoaiChat || {};
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

// Append form HTML to the chat
const appendFormHTML = () => {
  const formFields = generateFormFields();
  if (formFields) {
    const formHTML = `<div id="form-overlay" class="form-overlay" style="z-index: 9999;"><form id="user-form">${formFields}<input type="submit" value="${
      window.vionikoaiChat?.submit || "Submit"
    }"></form></div>`;
    document
      .querySelector(".outer-container")
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
  }
};

// Validate form and hide it if valid
const validateForm = () => {
  const name = document.getElementById("name")?.value;
  const email = document.getElementById("email")?.value;
  const phone = document.getElementById("phone")?.value;
  const chatInput = document.getElementById("textInput");
  if (name && email && phone) {
    window.vionikoaiChat = {
      ...window.vionikoaiChat,
      chatId: generateRandomId(),
      name,
      email,
      phone,
    };
    document.getElementById("form-overlay").style.display = "none";
    chatInput.classList.remove("disabled");
    chatInput.removeAttribute("disabled"); // Enable the input again
  }
};

// Initialize form
const initializeForm = () => {
  appendFormHTML();
  showForm();
};

const appendChatHTML = () => {
  const inputPlaceholder =
    window.vionikoaiChat?.inputPlaceholder || "Tap Enter to send a message";
  const chatName = window.vionikoaiChat?.chatName || "VionikoAIChat!";
  const liveSupportButton =
    `<button id="live-support-button" class="live-support-button" aria-label="Live Support" style="position: fixed; bottom: 20px; right: 20px; background-color: #4CAF50; color: white; padding: 14px 20px; margin: 8px 0; border: none; cursor: pointer; width: auto; opacity: 0.9; z-index: 1000;">${window.vionikoaiChat.supportLabel || "Live Support"}</button>`;

  const chatHTML = `
    <div class="chat-bar-collapsible" style="z-index: 2000000001;">
      <button id="chat-button" type="button" class="collapsible chat-button" aria-label="Open chat" style="">
        ${chatName}<i class="fa fa-fw fa-comments-o chat-icon"></i>
      </button>
      <div class="content chat-content" style="">
      <div id="chat-live-support" style="display: none;">
        ${window.vionikoaiChat.supportType && liveSupportButton}
      </div>
        <div class="full-chat-block" style="">
          <div class="outer-container" style="">
            <div class="chat-container" style="">
              <div id="chatbox" class="chatbox" style="">
                <h5 id="chat-timestamp" class="chat-timestamp" style=""></h5>
                <p id="botStarterMessage" class="botText chat-bot-message" style=""><span>Loading...</span></p>
              </div>
              <div class="chat-bar-input-block" style="">
                <div id="userInput" class="user-input" style="">
                  <input id="textInput" class="input-box chat-input-box" type="text" name="msg" placeholder="${inputPlaceholder}" style="" />
                </div>
              </div>
              <div id="chat-bar-bottom" style=""></div>
              <div class="branding" style="">Powered by Vioniko</div>
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

// Load required scripts
const loadScripts = () => {
  const scripts = ["https://cdn.jsdelivr.net/npm/marked/marked.min.js"];
  Promise.all(
    scripts.map((src) => {
      return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = resolve;
        document.head.appendChild(script);
      });
    })
  ).then(() => {
    loadChatScript();
    initializeForm();
  });
};

// Attach Live Support Button
const attachLiveSupportButton = () => {
  const liveSupportButton = document.getElementById("live-support-button");
  const supportNumber = window.vionikoaiChat.supportContact || "15035833307"; // Replace with your actual support number

  liveSupportButton.addEventListener("click", () => {
    if(window.vionikoaiChat.supportType === "whatsapp"){
    window.open(
      `https://api.whatsapp.com/send?phone=${supportNumber}`,
      "_blank"
    );
    } else if(window.vionikoaiChat.supportType === "telegram"){
    
     window.open(`https://t.me/${supportNumber}`, "_blank");
    } else {
      window.open(`${supportNumber}`, "_blank");
    }
  });
};

// Initialize chat
const initializeChat = () => {
  loadStyles();
  appendChatHTML();
  loadScripts();
  attachLiveSupportButton();
};

// Initialize chat
initializeChat();
