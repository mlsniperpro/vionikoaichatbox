// Function to check if the document is ready
function ready(callbackFunction) {
  document.readyState !== "loading"
    ? callbackFunction()
    : document.addEventListener("DOMContentLoaded", callbackFunction);
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



// Validate form and hide it if valid, then open chatbox
const validateForm = (iframe) => {
  const doc = iframe.contentWindow.document;
  const name = doc.getElementById("name")?.value;
  const email = doc.getElementById("email")?.value;
  const phone = doc.getElementById("phone")?.value;
  if (name && email && phone) {
    window.vionikoaiChat = {
      ...window.vionikoaiChat,
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
  containerDiv.classList.add("closed");
  document.body.appendChild(containerDiv);

  const iDiv = document.createElement("div");
  iDiv.setAttribute("id", "vionikodiv");
  containerDiv.appendChild(iDiv);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("border", "0");
  iframe.setAttribute("title", "Vionikaio Chat");

  const formFields = generateFormFields();
  const srcTitle = `
  <html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
    <title>Chatbot in JavaScript | CodingNepal</title>
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/style.css">
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/form.css",">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Google Fonts Link For Icons -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@48,400,1,0" />
    <script src="https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/script.js" defer></script>
  </head>
  <body>
    <button class="chatbot-toggler">
      <span class="material-symbols-rounded">mode_comment</span>
      <span class="material-symbols-outlined">close</span>
    </button>
    <div class="chatbot">
      <header>
        <h2>${window.vionikoaiChat?.chatName}</h2>
        <span class="close-btn material-symbols-outlined">close</span>
      </header>
      <ul class="chatbox">
        <li class="chat incoming">
          <p>How can I help you today?</p>
        </li>
      </ul>
      <div class="chat-input">
        <textarea placeholder="${
          window.vionikoaiChat?.inputPlaceholder ||
          "Tap Enter to send a message"
        }" spellcheck="false" required></textarea>
        <span id="send-btn" class="material-symbols-rounded">send</span>
      </div>
    </div>
    <div id="form-overlay" class="form-overlay" style="display:none; z-index: 9999999999;"><form id="user-form">${formFields}<input type="submit" value="Submit"></form></div>
  </body>
</html>
  `;

  iDiv.appendChild(iframe);
  iframe.srcdoc = srcTitle;
  iframe.style.width = "100%";
  iframe.style.height = "100%";

  // Attach form submit event
  iframe.onload = () => {
    const doc = iframe.contentWindow.document;
    const form = doc.getElementById("user-form");
    const chatbotToggler = doc.querySelector(".chatbot-toggler");
    const formOverlay = doc.getElementById("form-overlay");
    const chatbot = doc.querySelector(".chatbot");

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        validateForm(iframe);
      });
    }

    if (chatbotToggler) {
      chatbotToggler.addEventListener("click", () => {
        console.log(formOverlay.style.display==="block")
        if (formOverlay.style.display==="block") {
          formOverlay.style.display = "none";
          chatbot.style.display = "none";
        } else {
          formOverlay.style.display = "block";
          chatbot.style.display = "none";
        }
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
  document.head.appendChild(
    Object.assign(document.createElement("link"), {
      id: "iframeCss",
      rel: "stylesheet",
      type: "text/css",
      href: "https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/iframe.css",
      media: "all",
    })
  );
}

// Ready function to initialize widget
ready(function () {
  initWidget();
  console.log(document.getElementById("container"));
  document.getElementById("container").addEventListener("click", function () {
    console.log("click");
  });
});
