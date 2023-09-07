function ready(calllbackFunction) {
  document.readyState !== "loading"
    ? calllbackFunction()
    : document.addEventListener("DOMContentLoaded", calllbackFunction);
}
const generateRandomId = () => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length: 17 },
    () => characters[Math.floor(Math.random() * characters.length)]
  ).join("");
};

// Generate form fields based on window.vionikoaiChat properties
const generateFormFields = () => {
  const chatProps = window.vionikoaiChat || {};
  return ["name", "email", "phone"]
    .map((field) =>
      chatProps[field]
        ? `<label for="${field}">${
            field.charAt(0).toUpperCase() + field.slice(1)
          }:</label><input type="${
            field === "email" ? "email" : "text"
          }" id="${field}" name="${field}" required>`
        : ""
    )
    .join("");
};
function loadIframe() {
  let containerDiv = document.createElement("div");
  containerDiv.setAttribute("id", "container");
  containerDiv.classList.add("closed");
  document.body.appendChild(containerDiv);
  const iDiv = document.createElement("div");
  iDiv.setAttribute("id", "vionikodiv");
  containerDiv.appendChild(iDiv);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("border", "0");
  iframe.setAttribute("title", "Vionikaio Chat");
  const formFields = generateFormFields();
  const srcTitle = `
  <html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
    <title>Chatbot in JavaScript | CodingNepal</title>
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/chat.css">
    <link rel="stylesheet" href="https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/form.css">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <div id="form-overlay" class="form-overlay" style="z-index: 9999;"><form id="user-form">${formFields}<input type="submit" value="Submit"></form></div>
  <script src="https://mlsniperpro.github.io/vionikoaichatbox/client/static/scripts/chat.js"></script>
  </body>
</html>
  `;

  iDiv.appendChild(iframe);

  iframe.srcdoc = srcTitle;

  iframe.style.width = "100%";
  iframe.style.height = "100%";
}

function initWidget() {
  initCSSWidget();
  loadIframe();
}
function initCSSWidget() {
  document.head.appendChild(
    Object.assign(document.createElement("link"), {
      id: "iframeCss",
      rel: "stylesheet",
      type: "text/css",
      href: "https://mlsniperpro.github.io/vionikoaichatbox/client/static/css/iframe.css",
      media: "all",
    })
  );
}
ready(function () {
  initWidget();
  console.log(document.getElementById("container"));
  document.getElementById("container").addEventListener("click", function () {
    console.log("click");
  });
});
