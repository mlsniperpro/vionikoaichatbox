// Remend repairs incomplete Markdown while an AI response is still streaming.
// Keep this tiny bridge as an ES module because the upstream package is ESM-only.
// The widget treats it as an optional enhancement and safely falls back to plain
// text if the CDN is unavailable or a host page's Content Security Policy blocks it.
import remend from "https://cdn.jsdelivr.net/npm/remend@1.3.0/+esm";

window.vionikoRemend = remend;
