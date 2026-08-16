// E2E test for both vionikoaichatbox widget variants.
//
// Serves the test pages from localhost; intercepts the GitHub Pages URLs and
// fulfills them from the local working tree, so the LOCAL edits are what
// runs. /api/pdf is mocked so tests are deterministic and never consume a
// customer's token or metered usage.
//
// Run from the repo root (playwright is not committed — install ad hoc):
//   npm i --no-save playwright && npx playwright install chromium
//   python3 -m http.server 8787 --directory test &
//   node test/e2e.mjs
//
// Screenshots are written to /tmp/vioniko-e2e/.
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const REPO = path.resolve(new URL(".", import.meta.url).pathname, "..");
const GH_PREFIX = "https://mlsniperpro.github.io/vionikoaichatbox/";
const BASE = "http://localhost:8787";
const TEST_EMBED_TOKEN = "e2e-signed-embed-token";
const SCREENSHOT_DIR = "/tmp/vioniko-e2e";
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let pass = 0,
  fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${extra ? `  [${extra}]` : ""}`);
  }
};

const MIME = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
};

async function newPage(
  browser,
  errors,
  apiRequests,
  viewport = { width: 1280, height: 800 }
) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  await page.route("https://www.chatvioniko.com/api/pdf", async (route) => {
    const request = route.request();
    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "Content-Type, Accept",
    };

    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: corsHeaders });
    }

    const payload = request.postDataJSON();
    apiRequests.push(payload);
    const userMessage = payload.messages?.at(-1)?.content || "";
    const reply = userMessage.includes("lista markdown")
      ? "- Primera capacidad\n- Segunda capacidad\n- Tercera capacidad"
      : "Respuesta de prueba segura.";

    // Keep the response in flight briefly so loading and stop-control states
    // are exercised instead of racing an instantaneous mock.
    await new Promise((resolve) => setTimeout(resolve, 700));

    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      headers: corsHeaders,
      body: `0:${JSON.stringify(reply)}\n`,
    });
  });
  await page.route(`${GH_PREFIX}**`, (route) => {
    const url = new URL(route.request().url());
    const rel = url.pathname.replace(/^\/vionikoaichatbox\//, "");
    const file = path.join(REPO, rel);
    try {
      route.fulfill({
        body: fs.readFileSync(file),
        contentType: MIME[path.extname(file)] || "text/plain",
        headers: { "access-control-allow-origin": "*" },
      });
    } catch {
      route.fulfill({ status: 404, body: "not found locally: " + file });
    }
  });
  return page;
}

function checkApiConfiguration(variant, apiRequests) {
  const payload = apiRequests[0] || {};
  check(
    `${variant}: embed token forwarded`,
    payload.embedToken === TEST_EMBED_TOKEN
  );
  check(`${variant}: temperature normalized`, payload.temperature === 0.6);
  check(`${variant}: language forwarded`, payload.language === "Spanish");
  check(`${variant}: embedded origin forwarded`, payload.origin === "embedded");
  check(
    `${variant}: conversation forwarded`,
    payload.conversationId === "213a17aa-7f03-4646-b689-8fcad9ab8b84"
  );
  check(`${variant}: stable chat id forwarded`, !!payload.data?.chatId);
}

// Wait until the latest bot message has settled (text stable for 3s, no loader)
async function waitForBotReply(scope, botSelector, timeoutMs = 90000) {
  const start = Date.now();
  let last = "";
  let stableSince = 0;
  while (Date.now() - start < timeoutMs) {
    const txt = await scope
      .locator(botSelector)
      .last()
      .textContent()
      .catch(() => "");
    const loading = await scope
      .locator(".loader")
      .count()
      .catch(() => 0);
    if (txt && txt.trim().length > 0 && loading === 0) {
      if (txt === last) {
        if (stableSince && Date.now() - stableSince > 3000) return txt.trim();
      } else {
        last = txt;
        stableSince = Date.now();
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return last.trim();
}

const XSS_PAYLOAD = `<img src=x onerror="window.__xss=1"> hola`;
const MD_PROMPT =
  "Por favor responde SOLO con una lista markdown de 3 viñetas (usando -) sobre lo que puedes hacer.";

async function testDirect(browser) {
  console.log("\n=== DIRECT VARIANT (chatWidget.js) ===");
  const errors = [];
  const apiRequests = [];
  const page = await newPage(browser, errors, apiRequests);
  await page.goto(`${BASE}/direct.html`);

  // Widget boots
  await page.waitForSelector("#chat-button", { timeout: 15000 });
  check("widget boots (#chat-button present)", true);

  // Preconnects added
  const preconnects = await page.locator('link[rel="preconnect"]').count();
  check(`preconnect links added (${preconnects})`, preconnects >= 4);

  // Markdown libs eventually present (pinned versions)
  await page
    .waitForFunction(
      () => window.marked && window.DOMPurify && window.vionikoRemend,
      null,
      { timeout: 15000 }
    )
    .catch(() => {});
  const libs = await page.evaluate(() => ({
    marked: !!window.marked?.parse,
    dompurify: !!window.DOMPurify?.sanitize,
    remend:
      typeof window.vionikoRemend === "function" &&
      window.vionikoRemend("This is **partial") === "This is **partial**",
  }));
  check("marked loaded (pinned)", libs.marked);
  check("DOMPurify loaded (pinned)", libs.dompurify);
  check("Remend loaded and repairs partial Markdown", libs.remend);

  // Open chat
  await page.click("#chat-button");
  await page.waitForTimeout(600);

  // Lead form gates the input
  const formVisible = await page.locator("#user-form").isVisible();
  check("lead form shown", formVisible);
  await page.waitForTimeout(300);
  check(
    "configured language localizes widget chrome",
    (await page.locator(".chat-header-copy small").textContent()).includes(
      "En línea"
    ) &&
      (await page.locator("#form-title").textContent()) ===
        "Inicia la conversación"
  );
  check(
    "input disabled while form is open",
    await page.locator("#textInput").isDisabled()
  );

  // Fill + submit form
  await page.fill("#name", "Prueba E2E");
  await page.fill("#email", "e2e@example.com");
  await page.fill("#phone", "+10000000000");
  await page.click('#user-form button[type="submit"]');
  await page.waitForTimeout(300);
  check(
    "form hidden after submit",
    !(await page.locator("#form-overlay").isVisible())
  );
  check(
    "input enabled after submit",
    !(await page.locator("#textInput").isDisabled())
  );
  check(
    "input auto-focused after form",
    await page.evaluate(() => document.activeElement?.id === "textInput")
  );

  // Branding links to chatvioniko.com
  const brandingHref = await page
    .locator(".branding a")
    .getAttribute("href")
    .catch(() => null);
  check(
    "branding links to chatvioniko.com",
    brandingHref === "https://www.chatvioniko.com",
    String(brandingHref)
  );

  // Empty send does nothing
  const userCount0 = await page.locator("#chatbox .userText").count();
  await page.press("#textInput", "Enter");
  await page.waitForTimeout(300);
  check(
    "empty Enter sends nothing",
    (await page.locator("#chatbox .userText").count()) === userCount0
  );

  // XSS payload renders as text, does not execute
  await page.fill("#textInput", XSS_PAYLOAD);
  await page.press("#textInput", "Enter");
  await page.waitForTimeout(400);
  check(
    "loader appears after send",
    (await page.locator("#chatbox .loader").count()) > 0
  );
  const bubbleText = await page
    .locator("#chatbox .userText")
    .last()
    .textContent();
  check(
    "user XSS payload rendered as literal text",
    bubbleText.includes("<img src=x"),
    JSON.stringify(bubbleText)
  );
  check(
    "no <img> element injected",
    (await page.locator('#chatbox img[src="x"]').count()) === 0
  );
  const reply1 = await waitForBotReply(page, "#chatbox .botText span");
  check(
    `bot replied to msg 1 (${reply1.length} chars)`,
    reply1.length > 5,
    reply1.slice(0, 80)
  );
  check(
    "XSS did not execute",
    await page.evaluate(() => window.__xss === undefined)
  );
  check(
    "no <img> anywhere in chat after bot reply (echoed payload sanitized)",
    (await page.locator("#chatbox img").count()) === 0
  );
  checkApiConfiguration("direct", apiRequests);

  // Markdown reply + explicit busy/stop state
  await page.fill("#textInput", MD_PROMPT);
  await page.press("#textInput", "Enter");
  await page.waitForTimeout(100);
  check(
    "composer disabled while response streams",
    await page.locator("#textInput").isDisabled()
  );
  check(
    "send control becomes a stop control",
    (await page.locator("#sendButton").getAttribute("data-mode")) === "stop"
  );
  const reply2 = await waitForBotReply(page, "#chatbox .botText span");
  check(`bot replied to msg 2 (${reply2.length} chars)`, reply2.length > 5);
  check(
    "composer re-enabled after response",
    !(await page.locator("#textInput").isDisabled())
  );
  const mdInfo = await page.evaluate(() => {
    const spans = document.querySelectorAll("#chatbox .botText span.md");
    const lastMd = spans[spans.length - 1];
    return {
      mdCount: spans.length,
      hasList: !!lastMd?.querySelector("ul li, ol li"),
      html: lastMd ? lastMd.innerHTML.slice(0, 150) : "",
    };
  });
  check("bot reply rendered as markdown (.md)", mdInfo.mdCount > 0);
  check("markdown list rendered as <ul>/<li>", mdInfo.hasList, mdInfo.html);

  // Internal scrolling, not host-page scrolling
  const scrollInfo = await page.evaluate(() => ({
    pageScroll: window.scrollY,
    boxScrollable: (() => {
      const b = document.getElementById("chatbox");
      return b.scrollHeight > b.clientHeight;
    })(),
  }));
  check(
    "host page NOT scrolled during chat",
    scrollInfo.pageScroll === 0,
    `scrollY=${scrollInfo.pageScroll}`
  );
  check("chatbox scrolls internally", scrollInfo.boxScrollable);

  // chatCount metered
  check(
    "chatCount === 2 after two turns",
    await page.evaluate(() => window.chatCount === 2)
  );

  await page.screenshot({
    path: "/tmp/vioniko-e2e/direct-final.png",
    clip: { x: 1280 - 480, y: 80, width: 480, height: 720 },
  });

  const realErrors = errors.filter(
    (e) => !e.includes("favicon") && !e.includes("net::ERR_")
  );
  check("no page errors", realErrors.length === 0, realErrors.join(" | "));
  await page.close();
}

async function testIframe(browser) {
  console.log("\n=== IFRAME VARIANT (chatWidgetIframe.js) ===");
  const errors = [];
  const apiRequests = [];
  const page = await newPage(browser, errors, apiRequests);
  await page.goto(`${BASE}/iframe.html`);

  await page.waitForSelector("#vionikodiv iframe", { timeout: 15000 });
  const frameEl = await page.$("#vionikodiv iframe");
  const frame = await frameEl.contentFrame();
  await frame.waitForSelector(".chatbot-toggler", { timeout: 15000 });
  check("iframe widget boots (.chatbot-toggler present)", true);

  // iframe accessibility + identity
  check(
    "iframe title uses chatName",
    (await frameEl.getAttribute("title")) === "Tu Asesor Virtual IMM"
  );
  check(
    "document title is not CodingNepal template",
    !(await frame.title()).includes("CodingNepal"),
    await frame.title()
  );
  check(
    "toggler has aria-label",
    !!(await frame.locator(".chatbot-toggler").getAttribute("aria-label"))
  );
  const preconnects = await frame.locator('link[rel="preconnect"]').count();
  check(`preconnect links in iframe head (${preconnects})`, preconnects >= 4);

  // Markdown libs (pinned) inside iframe
  await frame
    .waitForFunction(
      () => window.marked && window.DOMPurify && window.vionikoRemend,
      null,
      { timeout: 15000 }
    )
    .catch(() => {});
  const libs = await frame.evaluate(() => ({
    marked: !!window.marked?.parse,
    dompurify: !!window.DOMPurify?.sanitize,
    remend:
      typeof window.vionikoRemend === "function" &&
      window.vionikoRemend("This is **partial") === "This is **partial**",
  }));
  check("marked loaded in iframe (pinned)", libs.marked);
  check("DOMPurify loaded in iframe (pinned)", libs.dompurify);
  check("Remend loaded in iframe and repairs partial Markdown", libs.remend);

  // Open chat → lead form first
  await frame.click(".chatbot-toggler");
  await frame.waitForSelector("#form-overlay", { state: "visible", timeout: 5000 });
  check("lead form shown on open", true);
  await page.waitForTimeout(300);
  check(
    "configured language localizes widget chrome",
    (await frame.locator(".chat-header-copy p").textContent()).includes(
      "En línea"
    ) &&
      (await frame.locator("#form-title").textContent()) ===
        "Inicia la conversación"
  );
  check(
    "first form field auto-focused",
    await frame.evaluate(() => document.activeElement?.id === "name")
  );
  await frame.fill("#name", "Prueba E2E");
  await frame.fill("#email", "e2e@example.com");
  await frame.fill("#phone", "+10000000000");
  await frame.click('#user-form button[type="submit"]');
  await frame.waitForSelector(".chatbot", { state: "visible", timeout: 5000 });
  check("chatbot shown after form submit", true);
  check(
    "textarea auto-focused after form",
    await frame.evaluate(
      () => document.activeElement?.tagName === "TEXTAREA"
    )
  );

  // Branding present
  check(
    "branding links to chatvioniko.com",
    (await frame.locator(".branding a").getAttribute("href")) ===
      "https://www.chatvioniko.com"
  );

  // Empty send does nothing
  const out0 = await frame.locator(".chatbox .outgoing").count();
  await frame.press(".chat-input textarea", "Enter");
  await page.waitForTimeout(300);
  check(
    "empty Enter sends nothing",
    (await frame.locator(".chatbox .outgoing").count()) === out0
  );

  // XSS payload
  await frame.fill(".chat-input textarea", XSS_PAYLOAD);
  await frame.press(".chat-input textarea", "Enter");
  await page.waitForTimeout(400);
  const bubbleText = await frame
    .locator(".chatbox .outgoing p")
    .last()
    .textContent();
  check(
    "user XSS payload rendered as literal text",
    bubbleText.includes("<img src=x")
  );
  check(
    "no <img> element injected",
    (await frame.locator('.chatbox img[src="x"]').count()) === 0
  );
  const reply1 = await waitForBotReply(frame, ".chatbox .incoming p");
  check(
    `bot replied to msg 1 (${reply1.length} chars)`,
    reply1.length > 5,
    reply1.slice(0, 80)
  );
  check(
    "XSS did not execute (iframe + parent)",
    (await frame.evaluate(() => window.__xss === undefined)) &&
      (await page.evaluate(() => window.__xss === undefined))
  );
  check(
    "no <img> anywhere in chat after bot reply (echoed payload sanitized)",
    (await frame.locator(".chatbox img").count()) === 0
  );
  checkApiConfiguration("iframe", apiRequests);

  // Markdown + explicit busy/stop state
  await frame.fill(".chat-input textarea", MD_PROMPT);
  await frame.press(".chat-input textarea", "Enter");
  await page.waitForTimeout(100);
  check(
    "composer disabled while response streams",
    await frame.locator(".chat-input textarea").isDisabled()
  );
  check(
    "send control becomes a stop control",
    (await frame.locator("#send-btn").getAttribute("data-mode")) === "stop"
  );
  const reply2 = await waitForBotReply(frame, ".chatbox .incoming p");
  check(`bot replied to msg 2 (${reply2.length} chars)`, reply2.length > 5);
  check(
    "composer re-enabled after response",
    !(await frame.locator(".chat-input textarea").isDisabled())
  );
  const mdInfo = await frame.evaluate(() => {
    const els = document.querySelectorAll(".chatbox .incoming p.md");
    const last = els[els.length - 1];
    return {
      mdCount: els.length,
      hasList: !!last?.querySelector("ul li, ol li"),
      html: last ? last.innerHTML.slice(0, 150) : "",
    };
  });
  check("bot reply rendered as markdown (.md)", mdInfo.mdCount > 0);
  check("markdown list rendered as <ul>/<li>", mdInfo.hasList, mdInfo.html);

  // Host page must not scroll
  check(
    "host page NOT scrolled during chat",
    (await page.evaluate(() => window.scrollY)) === 0
  );

  await page.screenshot({ path: "/tmp/vioniko-e2e/iframe-final.png" });

  // Close button works
  await frame.click(".close-btn");
  await page.waitForTimeout(300);
  check(
    "close button closes widget",
    await page.evaluate(() =>
      document.getElementById("vionikodiv").classList.contains("closed")
    )
  );

  const realErrors = errors.filter(
    (e) => !e.includes("favicon") && !e.includes("net::ERR_")
  );
  check("no page errors", realErrors.length === 0, realErrors.join(" | "));
  await page.close();
}

async function testMobileLayouts(browser) {
  console.log("\n=== MOBILE RESPONSIVE LAYOUTS ===");
  const viewport = { width: 390, height: 844 };

  const directErrors = [];
  const directPage = await newPage(browser, directErrors, [], viewport);
  await directPage.goto(`${BASE}/direct.html`);
  await directPage.waitForSelector("#chat-button", { timeout: 15000 });
  await directPage.click("#chat-button");
  await directPage.waitForSelector("#form-overlay", {
    state: "visible",
    timeout: 5000,
  });
  await directPage.waitForTimeout(300);
  const directBox = await directPage
    .locator(".chat-bar-collapsible")
    .boundingBox();
  const directFormBox = await directPage.locator("#user-form").boundingBox();
  check(
    "direct mobile widget fills viewport",
    directBox?.x === 0 &&
      directBox?.y === 0 &&
      Math.round(directBox?.width || 0) === viewport.width &&
      Math.round(directBox?.height || 0) === viewport.height
  );
  check(
    "direct mobile form stays within viewport",
    directFormBox &&
      directFormBox.x >= 0 &&
      directFormBox.y >= 0 &&
      directFormBox.x + directFormBox.width <= viewport.width &&
      directFormBox.y + directFormBox.height <= viewport.height
  );
  await directPage.screenshot({
    path: `${SCREENSHOT_DIR}/direct-mobile-form.png`,
  });
  await directPage.click("#chat-button");
  check(
    "direct mobile header closes widget",
    (await directPage.locator("#chat-button").getAttribute("aria-expanded")) ===
      "false"
  );
  await directPage.close();

  const iframeErrors = [];
  const iframePage = await newPage(browser, iframeErrors, [], viewport);
  await iframePage.goto(`${BASE}/iframe.html`);
  await iframePage.waitForSelector("#vionikodiv iframe", { timeout: 15000 });
  const iframeElement = await iframePage.$("#vionikodiv iframe");
  const mobileFrame = await iframeElement.contentFrame();
  await mobileFrame.waitForSelector(".chatbot-toggler", { timeout: 15000 });
  await mobileFrame.click(".chatbot-toggler");
  await mobileFrame.waitForSelector("#form-overlay", {
    state: "visible",
    timeout: 5000,
  });
  await iframePage.waitForTimeout(300);
  const iframeBox = await iframePage.locator("#vionikodiv").boundingBox();
  const iframeFormBox = await mobileFrame.locator("#user-form").boundingBox();
  check(
    "iframe mobile widget fills viewport",
    iframeBox?.x === 0 &&
      iframeBox?.y === 0 &&
      Math.round(iframeBox?.width || 0) === viewport.width &&
      Math.round(iframeBox?.height || 0) === viewport.height
  );
  check(
    "iframe mobile form stays within viewport",
    iframeFormBox &&
      iframeFormBox.x >= 0 &&
      iframeFormBox.y >= 0 &&
      iframeFormBox.x + iframeFormBox.width <= viewport.width &&
      iframeFormBox.y + iframeFormBox.height <= viewport.height
  );
  await iframePage.screenshot({
    path: `${SCREENSHOT_DIR}/iframe-mobile-form.png`,
  });
  await mobileFrame.click(".form-close");
  await iframePage.waitForTimeout(300);
  check(
    "iframe mobile form can close without submitting",
    await iframePage.evaluate(() =>
      document.getElementById("vionikodiv").classList.contains("closed")
    )
  );
  await iframePage.close();

  check(
    "mobile layouts have no page errors",
    directErrors.length === 0 && iframeErrors.length === 0,
    [...directErrors, ...iframeErrors].join(" | ")
  );
}

const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
try {
  await testDirect(browser);
  await testIframe(browser);
  await testMobileLayouts(browser);
} finally {
  await browser.close();
}
console.log(`\n========== RESULT: ${pass} passed, ${fail} failed ==========`);
process.exit(fail ? 1 : 0);
