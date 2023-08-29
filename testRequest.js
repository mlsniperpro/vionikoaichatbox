/*const http = require("http");

const subscriptionId = "I-SXMWDUVYFPNV"; // Replace with the actual subscriptionId

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/subscriptionDetails",
  method: "GET",
  headers: {
    "Subscriptionid": subscriptionId, // Sending subscriptionId as a custom header
  },
};

const req = http.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    try {
      console.log(JSON.parse(data)); // Print the received data
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      console.log("Raw response:", data); // Print the raw received data
    }
  });
});

req.on("error", (error) => {
  console.error("An error occurred:", error); // Log the error for debugging
});

req.end();
*/
// Create a new instance of XMLHttpRequest
const http = require("http");

const data = {
  userId: "M8LwxAfm26SimGbDs4LDwf1HuCb2",
  fileName: "Resume -Tushar Damani",
  prompt: "Hello",
};

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/fetchOpenAI",
  method: "POST",
  headers: {
    "Content-Type": "application/json;charset=UTF-8",
    "Content-Length": Buffer.byteLength(JSON.stringify(data)),
  },
};

const req = http.request(options, (res) => {
  let responseData = "";

  res.on("data", (chunk) => {
    responseData += chunk;
  });

  res.on("end", () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      console.log(responseData);
    } else {
      console.error("Server responded with error", res.statusCode);
    }
  });
});

req.on("error", (error) => {
  console.error("Connection error", error);
});

req.write(JSON.stringify(data));
req.end();

