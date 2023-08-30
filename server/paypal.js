import fetch from "node-fetch";

async function getAccessToken() {
  console.log("Attempting to get PayPal access token...");

  try {
    const response = await fetch("https://api.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Language": "en_US",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
        ).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    // Log the status for debugging
    console.log(`PayPal response status: ${response.status}`);

    const responseBody = await response.json();

    if (!response.ok) {
      console.error("Error response body:", responseBody);
      throw new Error(
        `Failed to get access token: ${response.status} - ${
          responseBody.error_description || "Unknown error"
        }`
      );
    }

    console.log("Successfully retrieved PayPal access token.");
    return responseBody.access_token;
  } catch (error) {
    console.error("Error while fetching PayPal access token:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

export { getAccessToken };
