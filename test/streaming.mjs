import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SCRIPT_VARIANTS = [
  ["client/static/scripts/chat.js", false],
  ["client/static/scripts/script.js", true],
];

function createFakeDom() {
  const classes = new Set();
  const classList = {
    add(...names) {
      names.forEach((name) => classes.add(name));
    },
    remove(...names) {
      names.forEach((name) => classes.delete(name));
    },
    toggle(name, force) {
      if (force === true) classes.add(name);
      else if (force === false) classes.delete(name);
      else if (classes.has(name)) classes.delete(name);
      else classes.add(name);
    },
    contains(name) {
      return classes.has(name);
    },
  };
  const element = {
    addEventListener() {},
    append() {},
    appendChild() {},
    closest() {
      return element;
    },
    focus() {},
    querySelector() {
      return element;
    },
    querySelectorAll() {
      return [];
    },
    removeAttribute() {},
    setAttribute() {},
    classList,
    dataset: {},
    style: {},
    disabled: false,
    scrollHeight: 0,
    scrollTop: 0,
    clientHeight: 0,
    value: "",
    textContent: "",
    nextElementSibling: null,
  };
  element.nextElementSibling = element;
  const document = {
    addEventListener() {},
    createElement() {
      return { ...element, classList: { ...classList }, dataset: {}, style: {} };
    },
    getElementById() {
      return element;
    },
    querySelector() {
      return element;
    },
    body: element,
  };
  return { document, element };
}

function chunkedResponse(chunks, headers) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }),
    { headers }
  );
}

async function loadVariant(file, iframe) {
  const { document } = createFakeDom();
  const config = { systemPrompt: "test" };
  const window = iframe
    ? { parent: { vionikoaiChat: config, document } }
    : { vionikoaiChat: config };
  const context = vm.createContext({
    window,
    document,
    console: { log() {}, error() {}, warn() {} },
    AbortController,
    ReadableStream,
    Response,
    TextDecoder,
    TextEncoder,
    clearTimeout,
    setTimeout,
  });
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return {
    consume: vm.runInContext("consumeChatStream", context),
    render: vm.runInContext("renderBotText", context),
    createStreamingRenderer: vm.runInContext(
      "createStreamingBotRenderer",
      context
    ),
    window,
  };
}

for (const [file, iframe] of SCRIPT_VARIANTS) {
  const { consume, render, createStreamingRenderer, window } =
    await loadVariant(file, iframe);
  const updates = [];

  const protocolText = await consume(
    chunkedResponse([`0:"Hel`, `lo "\n0:"w`, `orld"`, "\n"], {
      "content-type": "text/plain; charset=utf-8",
      "x-vercel-ai-data-stream": "v1",
    }),
    (text) => updates.push(text)
  );
  assert.equal(protocolText, "Hello world", `${file}: split protocol records`);
  assert.deepEqual(updates, ["Hello ", "Hello world"]);

  const sseText = await consume(
    chunkedResponse(
      [
        'data: {"type":"text-del',
        'ta","delta":"SSE "}\n\n',
        'data:{"choices":[{"delta":{"content":"works"}}]}\n\n',
        "data: [DONE]\n\n",
      ],
      { "content-type": "text/event-stream" }
    ),
    () => {}
  );
  assert.equal(sseText, "SSE works", `${file}: fragmented SSE records`);

  const rawText = await consume(
    chunkedResponse(["raw ", "text"], { "content-type": "text/plain" }),
    () => {}
  );
  assert.equal(rawText, "raw text", `${file}: raw text stream`);

  await assert.rejects(
    consume(
      chunkedResponse(['3:"stream failed"\n'], {
        "content-type": "text/plain",
        "x-vercel-ai-data-stream": "v1",
      }),
      () => {}
    ),
    /stream failed/,
    `${file}: protocol error propagation`
  );

  const markdownInputs = [];
  const remendCalls = [];
  let sanitizeOptions;
  window.marked = {
    parse(markdown) {
      markdownInputs.push(markdown);
      return `<p>${markdown}</p>`;
    },
  };
  window.DOMPurify = {
    sanitize(html, options) {
      sanitizeOptions = options;
      return html;
    },
  };
  window.vionikoRemend = (markdown, options) => {
    remendCalls.push({ markdown, options });
    return `${markdown}**`;
  };

  const streamingElement = createFakeDom().element;
  render(streamingElement, "This is **partial", { streaming: true });
  assert.equal(
    remendCalls[0]?.markdown,
    "This is **partial",
    `${file}: partial Markdown sent through Remend`
  );
  assert.equal(
    remendCalls[0]?.options?.linkMode,
    "text-only",
    `${file}: partial links are never made clickable`
  );
  assert.equal(
    markdownInputs[0],
    "This is **partial**",
    `${file}: repaired Markdown parsed during streaming`
  );
  assert.ok(
    sanitizeOptions.FORBID_ATTR.includes("style") &&
      sanitizeOptions.FORBID_TAGS.includes("img"),
    `${file}: streamed Markdown uses hardened sanitizer options`
  );

  window.vionikoRemend = undefined;
  markdownInputs.length = 0;
  const fallbackElement = createFakeDom().element;
  render(fallbackElement, "**safe fallback", { streaming: true });
  assert.equal(
    fallbackElement.textContent,
    "**safe fallback",
    `${file}: unavailable Remend falls back to plain text`
  );
  assert.equal(
    markdownInputs.length,
    0,
    `${file}: incomplete Markdown is not parsed without Remend`
  );

  const queuedFrames = new Map();
  let nextFrameId = 1;
  window.requestAnimationFrame = (callback) => {
    const id = nextFrameId++;
    queuedFrames.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => queuedFrames.delete(id);
  window.vionikoRemend = (markdown) => `${markdown}**`;
  markdownInputs.length = 0;
  let paintCount = 0;
  const throttledElement = createFakeDom().element;
  const streamingRenderer = createStreamingRenderer(
    throttledElement,
    () => paintCount++
  );
  streamingRenderer.update("First **chunk");
  streamingRenderer.update("Latest **chunk");
  assert.equal(
    queuedFrames.size,
    1,
    `${file}: token bursts coalesce into one animation frame`
  );
  const scheduledPaint = queuedFrames.values().next().value;
  queuedFrames.clear();
  scheduledPaint();
  assert.equal(
    markdownInputs.at(-1),
    "Latest **chunk**",
    `${file}: coalesced paint uses the latest accumulated text`
  );
  assert.equal(paintCount, 1, `${file}: coalesced stream paints once`);

  streamingRenderer.update("Pending **chunk");
  streamingRenderer.finish("Finished **chunk**");
  assert.equal(
    queuedFrames.size,
    0,
    `${file}: final render cancels a pending animation frame`
  );
  assert.equal(
    markdownInputs.at(-1),
    "Finished **chunk**",
    `${file}: final render parses the original completed Markdown`
  );
}

console.log(
  "PASS: fragmented protocol, SSE, raw text, stream errors, and live Markdown"
);
