(() => {
  // Load required stylesheets
  const loadStyles = () => {
    [
      //"static/css/chat.css",
      "https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/chat.css",
      //"static/css/form.css", // New stylesheet for the form
      "https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/form.css",
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css",
    ].forEach((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    });
  };

  // Generate form fields based on window.vionikoaiChat properties
  const generateFormFields = () => {
    let fields = "";
    if (window.vionikoaiChat?.name) {
      fields += `<label for="name">Name:</label><input type="text" id="name" name="name" required>`;
    }
    if (window.vionikoaiChat?.email) {
      fields += `<label for="email">Email:</label><input type="email" id="email" name="email" required>`;
    }
    if (window.vionikoaiChat?.phone) {
      fields += `<label for="phone">Phone:</label><input type="tel" id="phone" name="phone" required>`;
    }
    return fields;
  };

  // Append form HTML to the chat
  const appendFormHTML = () => {
    const formFields = generateFormFields();
    if (formFields) {
      const formHTML = `
        <div id="form-overlay" class="form-overlay">
          <form id="user-form">
            ${formFields}
            <input type="submit" value="Submit">
          </form>
        </div>`;
      document
        .querySelector(".outer-container")
        .insertAdjacentHTML("beforeend", formHTML);
    }
  };

  // Show form and attach submit event
  const showForm = () => {
    const form = document.getElementById("user-form");
    const formOverlay = document.getElementById("form-overlay");

    if (form && formOverlay) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        validateForm();
      });
    } else if (formOverlay) {
      formOverlay.style.display = "none";
    }
  };

  // Validate form and hide it if valid
  const validateForm = () => {
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const phone = document.getElementById("phone").value;

    if (name && email && phone) {
      document.getElementById("form-overlay").style.display = "none";
    }
  };

  // Initialize form
  const initializeForm = () => {
    appendFormHTML();
    showForm();
  };

  // Default chat settings
  const inputPlaceholder =
    window.vionikoaiChat?.inputPlaceholder || "Tap Enter to send a message";
  const chatName = window.vionikoaiChat?.chatName || "VionikoAIChat!";

  // Append chat HTML to the body
  const appendChatHTML = () => {
    const chatHTML = `
      <div class="chat-bar-collapsible">
        <button id="chat-button" type="button" class="collapsible chat-button" aria-label="Open chat">${chatName}
          <i class="fa fa-fw fa-comments-o chat-icon"></i>
        </button>
        <div class="content chat-content">
          <div class="full-chat-block">
            <div class="outer-container">
              <div class="chat-container">
                <div id="chatbox" class="chatbox">
                  <h5 id="chat-timestamp" class="chat-timestamp"></h5>
                  <p id="botStarterMessage" class="botText chat-bot-message"><span>Loading...</span></p>
                </div>
                <div class="chat-bar-input-block">
                  <div id="userInput" class="user-input">
                    <input id="textInput" class="input-box chat-input-box" type="text" name="msg" placeholder="${inputPlaceholder}" />
                  </div>
                </div>
                <div id="chat-bar-bottom" class="chat-bar-bottom"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", chatHTML);
  };

  // Load chat script
  const loadChatScript = () => {
    const chatScript = document.createElement("script");
    chatScript.src = //"static/scripts/chat.js";
    "https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/chat.js";
    document.body.appendChild(chatScript);
  };

  // Load required scripts
  const loadScripts = () => {
    const scripts = [
      "https://cdn.jsdelivr.net/npm/marked/marked.min.js",
      "https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js",
    ];

    scripts.forEach((src, index) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload =
        index === scripts.length - 1
          ? () => {
              loadChatScript();
              initializeForm(); // Initialize the form
            }
          : undefined;
      document.head.appendChild(script);
    });
  };
  // Initialize chat
  loadStyles();
  appendChatHTML();
  loadScripts();
})();
