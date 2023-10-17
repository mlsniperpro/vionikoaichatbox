const queryGetContext = async (userId, rawFileName, prompt) => {
  const requestBody = JSON.stringify({ userId, fileName: rawFileName, prompt });
  const config = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: requestBody,
  };

  try {
    const response = await fetch(
      "https://us-central1-vioniko-82fcb.cloudfunctions.net/getContext",
      config
    );
    const { context, error } = await response.json();

    if (response.ok) {
      // Checks for all 2xx status codes
      console.log("Received context:", context);
      return context ?? null; // Use nullish coalescing to return null if context is undefined
    } else {
      console.error("Error:", error ?? "Unknown error");
      throw new Error(error ?? "Unknown error");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
};

const previousMessages = [
  {
    role: "system",
    content: window.vionikoaiChat?.systemPrompt || "",
  },
];
// Function to sanitize HTML
const sanitizeHTML = (str) => {
  const temp = document.createElement("div");
  temp.textContent = str;
  return temp.innerHTML;
};
const fetchResponse = async (chat, userId) => {
  const signature = atob(
    "MEdmck9NOFlxUGRkWklPa2YzSWdKRmtibEIzVHpxTkJha0Z5R2VoNTdrazlBSzlqLWtz"
  )
    .split("")
    .reverse()
    .join("");
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + signature,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo-16k",
        messages: chat,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API responded with HTTP ${response.status}`);
    }
    console.log("I retuned the response immediately");
    return response.body.getReader();
  } catch (error) {
    console.error("Error fetching response:", error);
    throw error; // Propagate the error to the calling function
  }
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
  appendMessage("", "bot");
  const currentMessageElement =
    document.getElementById("chatbox").lastElementChild;
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
      temperature: Number(window.vionikoaiChat?.temperature),
    };
    const context = await queryGetContext(
      window.vionikoaiChat?.userId,
      window.vionikoaiChat?.fileName,
      input
    );
    console.log("The context is ", context);
    const prompt = `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.
  ----------------
  CONTEXT: ${context}
  ----------------
  QUESTION: ${input}
  ----------------
  Helpful Answer:`;
    
      const extendedMessages = [...previousMessages, { role: "user", content: prompt }]
    const response = await fetchResponse(
      extendedMessages,
      window.vionikoaiChat?.userId
    );
    previousMessages.push({
      role: "user",
      content: input,
    });
    currentMessageElement.classList.remove("loader");
    let accumulatedData = "";
    let accumulatedContent = "";
    const reader = response; //response.body.getReader();
      
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
    previousMessages.push(
      {
        role: "user",
        content: input,
      },
      {
        role: "assistant",
        content: currentMessageElement.querySelector("span").textContent,
      }
    );
    document.getElementById("chat-bar-bottom").scrollIntoView(true);
  }
}

// Initialize the chat
firstBotMessage();
