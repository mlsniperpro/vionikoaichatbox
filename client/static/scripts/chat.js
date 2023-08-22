// Utility Functions
const getTime = () => {
  const today = new Date();
  let hours = today.getHours();
  let minutes = today.getMinutes();

  hours = hours < 10 ? `0${hours}` : hours;
  minutes = minutes < 10 ? `0${minutes}` : minutes;

  return `${hours}:${minutes}`;
};

// Event Listeners
document.addEventListener("click", (event) => {
  let targetElement = event.target;

  while (targetElement !== null) {
    if (targetElement.classList.contains("collapsible")) {
      console.log("Chat icon clicked!");
      targetElement.classList.toggle("active");
      const content = targetElement.nextElementSibling;
      content.style.maxHeight = content.style.maxHeight
        ? null
        : `${content.scrollHeight}px`;
      return;
    }
    targetElement = targetElement.parentElement;
  }
});

$("#textInput").keypress((e) => {
  if (e.which === 13) {
    getResponse();
  }
});

// Bot Interaction Functions
const firstBotMessage = () => {
  const firstMessage = "Say Something...";
  document.getElementById(
    "botStarterMessage"
  ).innerHTML = `<p class="botText"><span>${firstMessage}</span></p>`;
  const time = getTime();
  $("#chat-timestamp").append(time);
  document.getElementById("userInput").scrollIntoView(false);
};

const getHardResponse = async (userText) => {
  const botResponse = await getBotResponse(userText);
  const botHtml = `<p class="botText"><span>${botResponse}</span></p>`;
  $("#chatbox").append(botHtml);
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
};

const getResponse = () => {
  let userText = $("#textInput").val();
  userText = userText || "I love Code Palace!";
  const userHtml = `<p class="userText"><span>${userText}</span></p>`;
  $("#textInput").val("");
  $("#chatbox").append(userHtml);
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
  setTimeout(() => {
    getHardResponse(userText);
  }, 1000);
};

const buttonSendText = (sampleText) => {
  const userHtml = `<p class="userText"><span>${sampleText}</span></p>`;
  $("#textInput").val("");
  $("#chatbox").append(userHtml);
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
};

const sendButton = () => getResponse();
const heartButton = () => buttonSendText("Heart clicked!");

async function getBotResponse(input) {
  try {
    const requestData = {
      userId: window.vionikoaiChat && window.vionikoaiChat.userId,
      prompt: input,
      fileName: window.vionikoaiChat && window.vionikoaiChat.fileName ,
    };
    console.log("The request data is ", requestData)
    const response = await fetch(
      "https://vionikochat.onrender.com/fetchOpenAI",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      }
    );
    console.log("The response is ", response);

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    console.log("The data is ", data.choices[0]);
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Error:", error);
    return "An error occurred. Please try again later.";
  }
}

firstBotMessage();
