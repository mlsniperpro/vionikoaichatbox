// Utility Functions

/**
 * Function to sanitize HTML
 * @param {string} str - The string to sanitize
 * @returns {string} - The sanitized HTML string
 */
const sanitizeHTML = (str) => {
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
};

/**
 * Function to append messages to the chatbox
 * @param {string} message - The message to append
 * @param {string} type - The type of message (e.g., 'user' or 'bot')
 */
const appendMessage = (message, type) => {
  const chatbox = document.getElementById("chatbox");
  const parsedMessage = marked.parse(sanitizeHTML(message));
  const messageHTML = `
      <p class="${type}Text">
        <span>${parsedMessage}</span>
      </p>`;
  chatbox.insertAdjacentHTML("beforeend", messageHTML);
};

/**
 * Function to get the current time in HH:MM format
 * @returns {string} - The current time in HH:MM format
 */
const getTime = () => {
  return `${new Date().getHours().toString().padStart(2, "0")}:${new Date()
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
};

// Event Listeners

// Collapsible event listener
document.addEventListener("click", (e) => {
  for (let t = e.target; t; t = t.parentElement) {
    if (t.classList.contains("collapsible")) {
      t.classList.toggle("active");
      const c = t.nextElementSibling;
      c.style.maxHeight = c.style.maxHeight ? null : `${c.scrollHeight}px`;
      return;
    }
  }
});

// Text input event listener
document.getElementById("textInput").addEventListener("keypress", (e) => {
  if (e.which === 13) {
    getResponse();
  }
});

// Initialize the chatbox with the first bot message
const firstBotMessage = () => {
  document.getElementById("botStarterMessage").innerHTML = `
    <p class="botText"><span>${
      window.vionikoaiChat.firstMessage || "Say Something..."
    }</span></p>`;
  document.getElementById("chat-timestamp").append(getTime());
  document.getElementById("userInput").scrollIntoView(false);
};
const getResponse = async () => {
  const userText = $("#textInput").val();
  $("#chatbox").append(`<p class="userText"><span>${userText}</span></p>`);
  $("#textInput").val("");
  $("#chat-bar-bottom")[0].scrollIntoView(true);
  await getBotResponse(userText);
};

const buttonSendText = (sampleText) => {
  $("#textInput").val("");
  $("#chatbox").append(`<p class="userText"><span>${sampleText}</span></p>`);
  $("#chat-bar-bottom")[0].scrollIntoView(true);
};
async function getBotResponse(input) {
  try {
    const requestData = {
      userId: window.vionikoaiChat?.userId,
      prompt: input,
      fileName: window.vionikoaiChat?.fileName,
    };

    const response = await fetch(
      "https://vionikochat.onrender.com/fetchOpenAI",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      }
    );

    if (!response.ok) throw new Error("Network response was not ok");

    let [accumulatedData, accumulatedContent, currentMessageElement] = [
      "",
      "",
      null,
    ];
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      accumulatedData += new TextDecoder().decode(value);
      const match = accumulatedData.match(/data: (.*?})\s/);

      if (match && match[1]) {
        let jsonData;
        try {
          jsonData = JSON.parse(match[1]);
          if (jsonData.choices[0].finish_reason === "stop") break;
        } catch (error) {
          continue;
        }

        const { delta } = jsonData.choices[0];
        if (delta && delta.content) {
          accumulatedContent += delta.content;

          if (!currentMessageElement) {
            $("#chatbox").append(
              `<p class="botText"><span>${accumulatedContent}</span></p>`
            );
            currentMessageElement = $("#chatbox").children().last();
          } else {
            currentMessageElement.find("span").text(accumulatedContent);
          }
        }
        accumulatedData = accumulatedData.replace(match[0], "");
      }
    }
    console.log("accumulatedData", accumulatedContent);
  } catch (error) {
    console.error("Error:", error);
    $("#chatbox").append(
      '<p class="botText"><span>An error occurred. Please try again later.</span></p>'
    );
    $("#chat-bar-bottom")[0].scrollIntoView(true);
  }
}
firstBotMessage();
