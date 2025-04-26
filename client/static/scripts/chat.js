// Initialize messages array with just the system prompt
const previousMessages = [
  {
    role: "system",
    content: window.vionikoaiChat?.systemPrompt || "",
  },
];

// Function to append messages to the chatbox
const appendMessage = (message, type) => {
  const chatbox = document.getElementById("chatbox");
  const parsedMessage = message;
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

// Function to stream chat responses from PDF API
async function streamFromPDFApi(input) {
  try {
    console.log("Starting PDF API request with message:", input);
    const response = await fetch("https://www.chatvioniko.com/api/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      mode: "cors",
      credentials: "omit",
      body: JSON.stringify({
        messages: [{ role: "user", content: input }],
        systemPrompt: window.vionikoaiChat?.systemPrompt || "",
        data: {
          conversationId: window.vionikoaiChat?.conversationId,
          fileName: window.vionikoaiChat?.fileName,
          userId: window.vionikoaiChat?.userId,
          chatId: window.vionikoaiChat?.chatId,
        },
        language: "English",
        origin: "embedded",
      }),
    });

    if (!response.ok) {
      throw new Error(`API responded with HTTP ${response.status}`);
    }

    console.log("PDF API response received, status:", response.status);
    return response;
  } catch (error) {
    console.error("Error streaming chat response:", error);
    throw error;
  }
}

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
  document.getElementById("chat-bar-bottom").scrollIntoView(true);
};

// Updated function to get bot response from the PDF API - simplified to not track history in client
async function getBotResponse(input) {
  appendMessage("", "bot");
  const currentMessageElement =
    document.getElementById("chatbox").lastElementChild;
  currentMessageElement.classList.add("loader");

  try {
    // Add the user message to previous messages
    previousMessages.push({ role: "user", content: input });

    // Just pass the current user input to the API
    const response = await streamFromPDFApi(input);
    let accumulatedContent = "";

    // Process the stream directly
    if (!response.body) {
      throw new Error("ReadableStream not supported by browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    currentMessageElement.classList.remove("loader");
    console.log("Beginning to read stream");

    // Process chunks as they arrive
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("Stream complete");
        break;
      }

      // Decode the chunk and log for debugging
      const chunk = decoder.decode(value, { stream: true });
      console.log("Raw chunk received:", chunk);

      // Process each line in the chunk
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;

        console.log("Processing line:", line);

        // Try to handle prefixed format (0:, f:, etc.)
        if (line.match(/^[0fed]:/)) {
          const prefix = line.substring(0, 2);
          const content = line.substring(2);

          try {
            const parsed = JSON.parse(content);
            console.log(`Parsed ${prefix} content:`, parsed);

            // Handle content chunks
            if (prefix === "0:" && typeof parsed === "string") {
              accumulatedContent += parsed;
              currentMessageElement.querySelector("span").textContent =
                accumulatedContent;
              // Force UI update
              window.requestAnimationFrame(() => {
                document.getElementById("chat-bar-bottom").scrollIntoView(true);
              });
            }
          } catch (parseError) {
            console.warn(
              `Failed to parse ${prefix} chunk:`,
              content,
              parseError
            );
          }
        }
        // Handle standard SSE format
        else if (line.startsWith("data: ")) {
          try {
            if (line.includes("data: [DONE]")) {
              console.log("Received DONE signal");
              continue;
            }

            const jsonData = JSON.parse(line.substring(6));
            console.log("Parsed SSE data:", jsonData);

            if (jsonData.choices && jsonData.choices[0].delta?.content) {
              const content = jsonData.choices[0].delta.content;
              accumulatedContent += content;
              currentMessageElement.querySelector("span").textContent =
                accumulatedContent;
              // Force UI update
              window.requestAnimationFrame(() => {
                document.getElementById("chat-bar-bottom").scrollIntoView(true);
              });
            }
          } catch (error) {
            console.warn("Failed to parse SSE data:", line, error);
          }
        }
        // Try to handle raw text if no specific format is detected
        else {
          try {
            // Check if it might be pure JSON
            const jsonData = JSON.parse(line);
            console.log("Parsed raw JSON:", jsonData);
            if (jsonData.text || jsonData.content) {
              const content = jsonData.text || jsonData.content;
              accumulatedContent += content;
              currentMessageElement.querySelector("span").textContent =
                accumulatedContent;
              // Force UI update
              window.requestAnimationFrame(() => {
                document.getElementById("chat-bar-bottom").scrollIntoView(true);
              });
            }
          } catch (e) {
            // Not JSON, might be plain text
            console.log("Treating as plain text");
            if (line.trim()) {
              accumulatedContent += line;
              currentMessageElement.querySelector("span").textContent =
                accumulatedContent;
              // Force UI update
              window.requestAnimationFrame(() => {
                document.getElementById("chat-bar-bottom").scrollIntoView(true);
              });
            }
          }
        }
      }
    }

    // Add the assistant's response to previous messages
    previousMessages.push({
      role: "assistant",
      content: accumulatedContent,
    });

    // Chat is complete - save to history
    window.chatCount ? window.chatCount++ : (window.chatCount = 1);

    // Save chat history (user message and bot response)
    await fetch(
      "https://us-central1-vioniko-82fcb.cloudfunctions.net/saveChatAndWordCount",
      {
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
      }
    );

    await fetch(
      "https://us-central1-vioniko-82fcb.cloudfunctions.net/saveChatAndWordCount",
      {
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
      }
    );
  } catch (error) {
    console.error("Error in getBotResponse:", error);
    currentMessageElement.classList.remove("loader");
    currentMessageElement.querySelector("span").textContent =
      "An error occurred. Please try again later.";
    document.getElementById("chat-bar-bottom").scrollIntoView(true);

    // If there's an error, we should still add the error message to the history
    previousMessages.push({
      role: "assistant",
      content: "An error occurred. Please try again later.",
    });
  }
}

// Initialize the chat
firstBotMessage();
