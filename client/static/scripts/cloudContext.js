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

module.exports = queryGetContext;
