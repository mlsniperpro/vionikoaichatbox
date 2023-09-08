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
// Function to generate response
const generateResponse = async (chatElement, userMessage) => {
  const messageElement = chatElement.querySelector("p");
  const requestData = {
    // Populate your requestData here
  };
  const response = await fetch("https://vionikochat.onrender.com/fetchOpenAI", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  });

  if (!response.ok) throw new Error("Network response was not ok");

  let accumulatedData = "";
  const reader = response.body.getReader();
  let iterations = 0;
  const maxIterations = 1000; // Set a maximum number of iterations as a safeguard

  while (true) {
    if (iterations >= maxIterations) {
      console.warn("Maximum iterations reached, breaking out of loop.");
      break;
    }

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
        messageElement.textContent += delta.content;
      }
    }

    iterations++;
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
