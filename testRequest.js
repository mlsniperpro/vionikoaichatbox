const http = require("http");

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
