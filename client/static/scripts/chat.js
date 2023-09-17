
const previousMessages = [
  {
    role: "system",
    content: window.vionikoaiChat?.systemPrompt,
  },
];
// Function to sanitize HTML
const sanitizeHTML = (str) => {
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
};

// Function to append messages to the chatbox
const appendMessage = (message, type) => {
  const chatbox = document.getElementById("chatbox");
  const parsedMessage = sanitizeHTML(message); // Assuming marked.parse is not needed here
  const messageHTML = `
      <p class="${type}Text">
        <span>${parsedMessage}</span>
      </p>`;
  chatbox.insertAdjacentHTML("beforeend", messageHTML);
};

// Function to get the current time in HH:MM format
const getTime = () => {
  return `${new Date().getHours().toString().padStart(2, "0")}:${new Date()
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
};

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
// Text input event listener
document.getElementById("textInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
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

// Function to get bot response
const getResponse = async () => {
  const userText = document.getElementById("textInput").value;
  appendMessage(userText, "user");
  document.getElementById("textInput").value = "";
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
  await getBotResponse(userText);
};

// Function to send text with a button
const buttonSendText = (sampleText) => {
  document.getElementById("textInput").value = "";
  //appendMessage(sampleText, "user");
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
};

// Function to get bot response from an API
async function getBotResponse(input) {
  appendMessage('', "bot");
  const currentMessageElement = document.getElementById("chatbox").lastElementChild;
  currentMessageElement.classList.add("loader");
  try {
    const requestData = {
      userId: window.vionikoaiChat?.userId,
      prompt: input,
      fileName: window.vionikoaiChat?.fileName,
      chatId: window.vionikoaiChat?.chatId,
      chatName: window.vionikoaiChat?.chatName,
      name: window.vionikoaiChat?.name,
      email: window.vionikoaiChat?.email,
      phone: window.vionikoaiChat?.phone,
      embedded: true,
      previousMessages,
      temperature: window.vionikoaiChat?.temperature,
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

    let accumulatedData = "";
    let accumulatedContent = "";
    const reader = response.body.getReader();
    currentMessageElement.classList.remove("loader");
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
            appendMessage(accumulatedContent, "bot");
            currentMessageElement =
              document.getElementById("chatbox").lastElementChild;
          } else {
            currentMessageElement.querySelector("span").textContent =
              accumulatedContent;
          }
        }
        accumulatedData = accumulatedData.replace(match[0], "");
      }
    }
  } catch (error) {
    console.error("Error:", error);
    appendMessage("An error occurred. Please try again later.", "bot");
    document.getElementById("chat-bar-bottom").scrollIntoView(true);
  } finally {
    previousMessages.push({
      "role": "user",
      "content": input
    },
    {
      "role": "assistant",
      "content": currentMessageElement.querySelector("span").textContent
    }
    )
    document.getElementById("chat-bar-bottom").scrollIntoView(true);
  }
}

// Initialize the chat
firstBotMessage();
