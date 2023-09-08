// Function to create a chat <li> element with passed message and className
const createChatLi = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", className);
  const chatContent =
    className === "outgoing"
      ? "<p></p>"
      : '<span class="material-symbols-outlined">smart_toy</span><p></p>';
  chatLi.innerHTML = chatContent;
  chatLi.querySelector("p").textContent = message;
  return chatLi;
};

// Function to generate response
const generateResponse = async (chatElement, userMessage) => {
  const messageElement = chatElement.querySelector("p");

  // Prepare request data
  const requestData = {
    userId: window.parent.vionikoaiChat?.userId,
    prompt: userMessage,
    fileName: window.parent.vionikoaiChat?.fileName,
    chatId: window.parent.vionikoaiChat?.chatId,
    chatName: window.parent.vionikoaiChat?.chatName,
    name: window.parent.vionikoaiChat?.name,
    email: window.parent.vionikoaiChat?.email,
    phone: window.parent.vionikoaiChat?.phone,
    embedded: true,
  };

  try {
    // Make the fetch request
    const response = await fetch(
      "https://vionikochat.onrender.com/fetchOpenAINoStream",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      }
    );

    // Check if the response is ok
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    // Parse the JSON response
    const responseData = await response.json();
    console.log("the response data is", responseData)
    const responseMessage = responseData.choices[0].message.content.trim();

    // Update the message element
    messageElement.textContent = responseMessage;
  } catch (error) {
    console.error("An error occurred:", error);
    messageElement.textContent = "An error occurred. Please try again.";
  }
};



// Function to handle chat
const handleChat = async (chatInput, chatbox, inputInitHeight) => {
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;
  chatInput.value = "";
  chatInput.style.height = `${inputInitHeight}px`;
  chatbox.appendChild(createChatLi(userMessage, "outgoing"));
  chatbox.scrollTo(0, chatbox.scrollHeight);
  const incomingChatLi = createChatLi("Thinking...", "incoming");
  chatbox.appendChild(incomingChatLi);
  chatbox.scrollTo(0, chatbox.scrollHeight);
  await generateResponse(incomingChatLi, userMessage);
};

document.addEventListener("DOMContentLoaded", () => {
  const chatbotToggler = document.querySelector(".chatbot-toggler");
  const closeBtn = document.querySelector(".close-btn");
  const chatbox = document.querySelector(".chatbox");
  const chatInput = document.querySelector(".chat-input textarea");
  const sendChatBtn = document.querySelector(".chat-input span");
  const inputInitHeight = chatInput.scrollHeight;

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
  closeBtn.addEventListener("click", () =>
    document.body.classList.remove("show-chatbot")
  );
  chatbotToggler.addEventListener("click", () =>
    document.body.classList.toggle("show-chatbot")
  );
});
