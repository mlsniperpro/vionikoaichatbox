(function () {
  // Load CSS for the chatbox
  var loadStyles = function () {
    var link1 = document.createElement("link");
    link1.rel = "stylesheet";
    link1.href =
     "https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/chat.css";
    document.head.appendChild(link1);

    var link2 = document.createElement("link");
    link2.rel = "stylesheet";
    link2.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css";
    document.head.appendChild(link2);
  };

  // Append chatbox HTML to the body
  var appendChatHTML = function () {
    var chatHTML = `
        <div class="chat-bar-collapsible">
            <button id="chat-button" type="button" class="collapsible" aria-label="Open chat">VionikoChat!
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
                                    <input id="textInput" class="input-box" type="text" name="msg" placeholder="Tap 'Enter' to send a message" />
                                </div>
                                <div class="chat-bar-icons">
                                    <i class="fa fa-fw fa-heart" style="color: crimson;" onclick="heartButton()" aria-label="Send a heart"></i>
                                    <i class="fa fa-fw fa-send" style="color: #333;" onclick="sendButton()" aria-label="Send message"></i>
                                </div>
                            </div>
                            <div id="chat-bar-bottom"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    document.body.insertAdjacentHTML("beforeend", chatHTML);
  };

  // Load chat.js after the chatbox HTML has been appended
  var loadChatScript = function () {
    var chatScript = document.createElement("script");
    chatScript.src =
      "https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/chat.js";
    document.body.appendChild(chatScript);
  };

  // Load jQuery and then chat.js
  var loadScripts = function () {
    if (typeof jQuery === "undefined") {
      var script = document.createElement("script");
      script.src =
        "https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js";
      script.onload = loadChatScript; // Load chat.js after jQuery
      document.head.appendChild(script);
    } else {
      loadChatScript();
    }
  };

  // Execute the functions in the correct order
  loadStyles();
  appendChatHTML();
  loadScripts();
})();
