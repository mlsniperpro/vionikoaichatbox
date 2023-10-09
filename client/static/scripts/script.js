// ## Initialization
const chatbotToggler = document.querySelector(".chatbot-toggler");
const previousMessages = [
  {
    role: "system",
    content: "Hello, how are you"//window.parent.vionikoaiChat?.systemPrompt || "",
  },
];
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

// ## Generate Response
// Function to generate a chat response from the server
const generateResponse = async (chatElement, userMessage) => {
  const messageElement = chatElement.querySelector("p");
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
    previousMessages,
    temperature: Number(window.parent.vionikoaiChat?.temperature),
  };

  try {
    /*const response = await fetch(
      "https://us-central1-vioniko-82fcb.cloudfunctions.net/fetchOpenAINoStream",
      // "https://vionikochat.onrender.com/fetchOpenAINoStream",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      }
    );

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const responseData = await response.json();
    const responseMessage = responseData.choices[0].message.content.trim();
    messageElement.textContent = responseMessage;*/
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
     chatElement.classList.remove("loader");
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
             messageElement.textContent =
               accumulatedContent;
         }
         accumulatedData = accumulatedData.replace(match[0], "");
       }
     }
  } catch (error) {
    console.error("An error occurred:", error);
    messageElement.textContent = "An error occurred. Please try again.";
  } finally {
    previousMessages.push({
      role: "user",
      content: userMessage,
    });
    previousMessages.push({
      role: "assistant",
      content: messageElement.textContent,
    });
    chatElement.classList.remove("loader");
  }
};

// ## Handle Chat
// Function to handle chat interactions
const handleChat = async (chatInput, chatbox, inputInitHeight) => {
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
