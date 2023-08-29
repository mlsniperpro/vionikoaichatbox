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
  await getBotResponse(userText);
  //document.getElementById("chat-bar-bottom").scrollIntoView(true);
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
      fileName: window.vionikoaiChat && window.vionikoaiChat.fileName,
    };

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

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    let accumulatedData = "";
    let accumulatedContent = "";
    let currentMessageElement;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      //if (done) break;
      const chunkText = new TextDecoder().decode(value);
      accumulatedData += chunkText;
      console.log("Accumulated data:", accumulatedData);
      // Try to extract and parse JSON from accumulated data
      let jsonData;
      const match = accumulatedData.match(/data: (.*?})\s/);
      if (match && match[1]) {
        try {
          jsonData = JSON.parse(match[1]);
          if( jsonData.choices[0].finish_reason === "stop" ){
            break;
          }
        } catch (error) {
          console.warn("Incomplete data chunk received:", match[1]);
          continue; // If parsing fails, wait for more data
        }

        if (
          jsonData.choices &&
          jsonData.choices[0] &&
          jsonData.choices[0].delta &&
          jsonData.choices[0].delta.content &&
          jsonData.choices[0].delta.content.trim() !== ""
        ) {
          accumulatedContent += jsonData.choices[0].delta.content;

          if (!currentMessageElement) {
            const botHtml = `<p class="botText"><span>${accumulatedContent}</span></p>`;
            $("#chatbox").append(botHtml);
            currentMessageElement = $("#chatbox").children().last();
          } else {
            currentMessageElement.find("span").text(accumulatedContent);
          }
        } else {
          console.warn("Unexpected data structure:", jsonData);
        }

        // Clear the processed data
        
        accumulatedData = accumulatedData.replace(match[0], "");
      }
    }
    console.log("Final data:", accumulatedContent);
    // Here, you can finalize the message if needed
  } catch (error) {
    console.error("Error:", error);
    const botHtml = `<p class="botText"><span>An error occurred. Please try again later.</span></p>`;
    $("#chatbox").append(botHtml);
    document.getElementById("chat-bar-bottom").scrollIntoView(true);
  }
}




firstBotMessage();
