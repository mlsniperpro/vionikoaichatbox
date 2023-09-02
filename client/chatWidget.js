(() => {
  const loadStyles = () => {
    [
      "https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/chat.css",
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css",
    ].forEach((href) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    });
  };

  const inputPlaceholder =
    window.vionikoaiChat?.inputPlaceholder || "Tap Enter to send a message";
  const chatName = window.vionikoaiChat?.chatName || "VionikoAIChat!";

  const appendChatHTML = () => {
    const chatHTML = `
      <div class="chat-bar-collapsible">
        <button id="chat-button" type="button" class="collapsible" aria-label="Open chat">${chatName}
          <i class="fa fa-fw fa-comments-o" style="color: #fff;"></i>
        </button>
        <div class="content">
          <div class="full-chat-block">
            <div class="outer-container">
              <div class="chat-container">
                <div id="chatbox">
                  <h5 id="chat-timestamp"></h5>
                  <p id="botStarterMessage" class="botText"><span>Loading...</span></p>
                </div>
                <div class="chat-bar-input-block">
                  <div id="userInput">
                    <input id="textInput" class="input-box" type="text" name="msg" placeholder="${inputPlaceholder}" />
                  </div>
                </div>
                <div id="chat-bar-bottom"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML("beforeend", chatHTML);
  };

  const loadChatScript = () => {
    const chatScript = document.createElement("script");
    chatScript.src =
      "https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/chat.js";
    document.body.appendChild(chatScript);
  };

  const loadScripts = () => {
    if (typeof jQuery === "undefined") {
      const script = document.createElement("script");
      script.src =
        "https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js";
      script.onload = loadChatScript;
      document.head.appendChild(script);
    } else {
      loadChatScript();
    }
  };

  loadStyles();
  appendChatHTML();
  loadScripts();
})();
