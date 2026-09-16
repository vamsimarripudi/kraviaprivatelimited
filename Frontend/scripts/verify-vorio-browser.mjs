// Local-only verification. Uses a separately launched headless Chrome on 9310.
// Never attach this script to a personal browser profile.
import { mkdir, writeFile } from "node:fs/promises";
const targets = await (await fetch("http://localhost:9310/json/list")).json();
const target = targets.find(item => item.type === "page");
if (!target) throw new Error("Isolated browser page unavailable");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener("open", resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", event => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
  if (pending.has(message.id)) { const { resolve, reject, timer } = pending.get(message.id); clearTimeout(timer); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
});
function command(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 45000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); }); }
async function evaluate(expression) { const response = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.text); return response.result.value; }
await command("Page.enable");
await command("Runtime.enable");
await mkdir("artifacts/yukta-review", { recursive: true });
const results = [];
try {
  for (const width of [1440, 768, 390]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await command("Page.navigate", { url: `${process.env.VORIO_VERIFY_ORIGIN ?? "https://www.kraviaprivatelimited.com"}/products/vorio` });
    for (let attempt = 0; attempt < 60; attempt++) { if (await evaluate('Boolean(document.querySelector(".vorio-market svg"))')) break; await new Promise(resolve => setTimeout(resolve, 500)); }
    const state = await evaluate('({title:document.title,chart:!!document.querySelector(".vorio-market svg"),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,canonical:document.querySelector("link[rel=canonical]")?.href,tableRows:document.querySelectorAll(".vorio-market tbody tr").length,splash:!!document.querySelector(".brand-splash"),faqText:document.body.innerText.includes("What is VORIO")})');
    if (!state.chart || state.splash || state.scrollWidth > state.width || state.tableRows !== 6) throw new Error(`Rendering failed: ${JSON.stringify(state)}`);
    await evaluate('document.querySelector(".vorio-market [class*=panel]").scrollIntoView()');
    await new Promise(resolve => setTimeout(resolve, 400));
    const screenshot = await command("Page.captureScreenshot", { format: "png" });
    await writeFile(`artifacts/yukta-review/vorio-${width}.png`, Buffer.from(screenshot.data, "base64"));
    await evaluate('[...document.querySelectorAll(".vorio-market button")].find(button=>button.textContent==="United States").focus()');
    await new Promise(resolve => setTimeout(resolve, 200));
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await command("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await new Promise(resolve => setTimeout(resolve, 200));
    state.usSelected = await evaluate('[...document.querySelectorAll(".vorio-market button")].some(button=>button.textContent==="United States" && button.getAttribute("aria-pressed")==="true")');
    if (!state.usSelected) throw new Error("Chart toggle failed");
    results.push(state);
  }
  await writeFile("artifacts/yukta-review/vorio-results.json", JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify({ results, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally { socket.close(); }
