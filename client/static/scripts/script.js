// ## Initialization
const chatbotToggler = document.querySelector(".chatbot-toggler");
const closeBtn = document.querySelector(".close-btn");
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input textarea");
const sendChatBtn = document.querySelector(".chat-input span");
const inputInitHeight = chatInput.scrollHeight;
const scrollPadding = document.createElement("div");
// Add a padding element to the chatbox
scrollPadding.style.height = "50px"; // Adjust this value based on your input box height
chatbox.appendChild(scrollPadding);
// ## Create Chat Element
// Function to create a new chat element
const createChatLi = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", className);
  const chatContent = className === "outgoing" ? "<p></p>" : "<p></p>";
  chatLi.innerHTML = chatContent;
  chatLi.querySelector("p").textContent = message;
  return chatLi;
};

// Function to generate a chat response from the server
const generateResponse = async (chatElement, userMessage) => {
  const messageElement = chatElement.querySelector("p");

  try {
    const response = await fetch("https://llm-functionalities.fly.dev/chatrag", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId: window.parent.vionikoaiChat?.conversationId,
        userId: window.parent.vionikoaiChat?.userId,
        messages: [
          {
            role: "user",
            content: userMessage
          }
        ]
      }),
    });

    chatElement.classList.remove("loader");
    let accumulatedContent = "";

    try {
      for await (const chunk of response.body) {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const content = line.slice(6); // Remove 'data: ' prefix
            accumulatedContent += content;
            messageElement.textContent = accumulatedContent;
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
          userId: window.parent.vionikoaiChat?.userId,
          chatId: window.parent.vionikoaiChat?.chatId,
          chatName: window.parent.vionikoaiChat?.chatName,
          name: window.parent.vionikoaiChat?.name,
          email: window.parent.vionikoaiChat?.email,
          phone: window.parent.vionikoaiChat?.phone,
          fileName: window.parent.vionikoaiChat?.fileName,
          message: userMessage,
          role: "user",
        }),
      });

      // Save assistant message
      await fetch("https://us-central1-vioniko-82fcb.cloudfunctions.net/saveChatAndWordCount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: window.parent.vionikoaiChat?.userId,
          chatId: window.parent.vionikoaiChat?.chatId,
          chatName: window.parent.vionikoaiChat?.chatName,
          name: window.parent.vionikoaiChat?.name,
          email: window.parent.vionikoaiChat?.email,
          phone: window.parent.vionikoaiChat?.phone,
          fileName: window.parent.vionikoaiChat?.fileName,
          message: accumulatedContent,
          role: "assistant",
        }),
      });
    } catch (error) {
      console.error("Streaming error:", error);
      throw error;
    }
  } catch (error) {
    console.error("An error occurred:", error);
    messageElement.textContent = "An error occurred. Please try again.";
  } finally {
    chatElement.classList.remove("loader");
  }
};

// ## Handle Chat
// Function to handle chat interactions
const handleChat = async (chatInput, chatbox, inputInitHeight) => {
    if (window.chatCount >= 3) {
      console.log(
        "I am now running because window.chatCount is greater than 3"
      );
      document.getElementById("live-support-container").style.display !==
        "block" &&
        (document.getElementById("live-support-container").style.display =
          "block");
    }
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;
  chatInput.value = "";
  chatInput.style.height = `${inputInitHeight}px`;
  chatbox.appendChild(createChatLi(userMessage, "outgoing"));
  chatbox.scrollTop = chatbox.scrollHeight;
  const incomingChatLi = createChatLi("", "incoming");
  incomingChatLi.classList.add("loader");
  chatbox.appendChild(incomingChatLi);
  chatbox.scrollTop = chatbox.scrollHeight;
  await generateResponse(incomingChatLi, userMessage);
};

// ## Event Listeners
// Attach event listeners to DOM elements
document.addEventListener("DOMContentLoaded", () => {
  /*Now let us select an element with the id vionikoid for later */
  const vionikoid = window.parent.document.getElementById("vionikodiv");
  if (vionikoid) {
    console.log("I found the element with the id vionikoid")
  } else {
    console.error("Element with ID 'vionikodiv' not found");
  }
  chatInput.addEventListener("input", () => {
    chatInput.style.height = `${inputInitHeight}px`;
    chatInput.style.height = `${chatInput.scrollHeight}px`;
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChat(chatInput, chatbox, inputInitHeight);
    }
  });

  sendChatBtn.addEventListener("click", () =>
    handleChat(chatInput, chatbox, inputInitHeight)
  );
  closeBtn.addEventListener("click", () =>{
    document.body.classList.remove("show-chatbot");
    vionikoid.classList.toggle("closed");
});
  chatbotToggler.addEventListener("click", () =>{
    document.body.classList.toggle("show-chatbot");
    vionikoid.classList.toggle("closed");
});
});
