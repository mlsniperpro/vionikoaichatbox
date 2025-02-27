// Function to sanitize HTML
const sanitizeHTML = (str) => {
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
};
// Function to append messages to the chatbox
const appendMessage = (message, type) => {
  const chatbox = document.getElementById("chatbox");
  const parsedMessage = message; // Assuming sanitization is done elsewhere
  const messageHTML = `<p class="${type}Text"><span>${parsedMessage}</span></p>`;
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
  if (window.chatCount >= 3) {
    console.log("I am now running because window.chatCount is greater than 3");
    document.getElementById("chat-live-support").style.display !== "block" &&
      (document.getElementById("chat-live-support").style.display = "block");
  }
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

// Function to get bot response from chatrag API
async function getBotResponse(input) {
  appendMessage("", "bot");
  const currentMessageElement = document.getElementById("chatbox").lastElementChild;
  currentMessageElement.classList.add("loader");
  
  try {
    const response = await fetch("https://llm-functionalities.fly.dev/chatrag", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId: window.vionikoaiChat?.conversationId,
        userId: window.vionikoaiChat?.userId,
        messages: [
          {
            role: "user",
            content: input
          }
        ]
      }),
    });

    currentMessageElement.classList.remove("loader");
    let accumulatedContent = "";

    try {
      for await (const chunk of response.body) {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const content = line.slice(6); // Remove 'data: ' prefix
            accumulatedContent += content;
            currentMessageElement.querySelector("span").textContent = accumulatedContent;
          }
        }
      }

      // After streaming completes, save the chat history
      window.chatCount ? window.chatCount++ : (window.chatCount = 1);

      // Save user message
      await fetch("https://us-central1-vioniko-82fcb.cloudfunctions.net/saveChatAndWordCount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: window.vionikoaiChat?.userId,
          chatId: window.vionikoaiChat?.chatId,
          chatName: window.vionikoaiChat?.chatName,
          name: window.vionikoaiChat?.name,
          email: window.vionikoaiChat?.email,
          phone: window.vionikoaiChat?.phone,
          fileName: window.vionikoaiChat?.fileName,
          message: input,
          role: "user",
        }),
      });

      // Save assistant message
      await fetch("https://us-central1-vioniko-82fcb.cloudfunctions.net/saveChatAndWordCount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: window.vionikoaiChat?.userId,
          chatId: window.vionikoaiChat?.chatId,
          chatName: window.vionikoaiChat?.chatName,
          name: window.vionikoaiChat?.name,
          email: window.vionikoaiChat?.email,
          phone: window.vionikoaiChat?.phone,
          fileName: window.vionikoaiChat?.fileName,
          message: accumulatedContent,
          role: "assistant",
        }),
      });
    } catch (error) {
      console.error("Streaming error:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error:", error);
    appendMessage("An error occurred. Please try again later.", "bot");
  } finally {
    document.getElementById("chat-bar-bottom").scrollIntoView(true);
  }
}

// Initialize the chat
firstBotMessage();
