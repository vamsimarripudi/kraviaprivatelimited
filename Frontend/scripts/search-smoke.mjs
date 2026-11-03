import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const canonicalOrigin = "https://www.kraviaprivatelimited.com";
const base = new URL(process.env.SEARCH_SMOKE_BASE_URL || "http://127.0.0.1:3100");
assert(["localhost", "127.0.0.1", "www.kraviaprivatelimited.com"].includes(base.hostname), "Use the local test server or the approved public production domain");
assert(!base.username && !base.password, "Do not put credentials into the smoke-test URL");
const decode = (value) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1].toLowerCase(), decode(match[2])]));
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gi"))].map((match) => attrs(match[0]));
const get = async (path, userAgent) => {
  const response = await fetch(new URL(path, base), { headers: userAgent ? { "User-Agent": userAgent } : {}, signal: AbortSignal.timeout(25000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return { response, body: await response.text() };
};

if (base.hostname !== "www.kraviaprivatelimited.com") {
  let available = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { await get("/robots.txt"); available = true; break; } catch { await delay(500); }
  }
  assert(available, "Local Next.js production server did not start");
}

const results = [];
const pagePaths = ["/", "/contact", "/support", "/company/about", "/company/leadership", "/company/faq", "/products/vidyaluma", "/products/nicerole", "/products/yukta", "/products/vorio"];
let faqHtml = "";
for (const path of pagePaths) {
  const { response, body } = await get(path);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert(!/noindex/i.test(response.headers.get("x-robots-tag") || ""), `${path}: response excludes indexing`);
  const metas = tags(body, "meta");
  const links = tags(body, "link");
  const canonicals = links.filter((link) => link.rel === "canonical");
  assert.equal(canonicals.length, 1, `${path}: must have one canonical`);
  assert.equal(new URL(canonicals[0].href).toString(), new URL(path, canonicalOrigin).toString(), `${path}: wrong canonical`);
  assert(metas.some((meta) => meta.property === "og:site_name" && meta.content === "KRAVIA"), `${path}: wrong site name`);
  assert(metas.some((meta) => meta.name === "robots" && /index/.test(meta.content) && !/noindex/.test(meta.content)), `${path}: wrong robots metadata`);
  assert(links.some((link) => link.rel === "icon" && link.href.startsWith("/icon.png")), `${path}: original favicon missing`);
  const structured = [...body.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  const websites = structured.filter((item) => item["@type"] === "WebSite");
  assert.equal(websites.length, 1, `${path}: one WebSite identity expected`);
  assert.equal(websites[0].name, "KRAVIA");
  assert.equal(websites[0].alternateName, "KRAVIA PRIVATE LIMITED");
  assert.equal(new URL(websites[0].url).origin, canonicalOrigin);
  const organization = structured.find((item) => item["@type"] === "Corporation");
  assert.equal(organization?.sameAs?.length, 4, `${path}: corporate profile identity missing`);
  if (path === "/company/faq") {
    faqHtml = body;
    const faq = structured.find((item) => item["@type"] === "FAQPage");
    assert.equal(faq?.mainEntity?.length, 7);
    const text = decode(body.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<[^>]*>/g, ""));
    for (const item of faq.mainEntity) { assert(text.includes(item.name)); assert(text.includes(item.acceptedAnswer.text)); }
    assert(links.some((link) => link.rel === "alternate" && link.type === "text/markdown" && link.href.endsWith("/company/faq.md")));
  }
  results.push({ check: "rendered-public-page", path, result: "PASS" });
}

const { body: robots } = await get("/robots.txt");
const agents = ["Googlebot", "bingbot", "Applebot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "Claude-SearchBot", "Claude-User", "*"];
const blocked = ["/admin", "/api", "/auth", "/corporate", "/office", "/finance", "/privacy-request", "/legal/preview"];
const groups = robots.split(/\n\s*\n/);
for (const agent of agents) {
  const group = groups.find((value) => value.split("\n").includes(`User-Agent: ${agent}`));
  assert(group, `Missing ${agent} policy`);
  assert(group.includes("Allow: /"));
  for (const path of blocked) assert(group.split("\n").includes(`Disallow: ${path}`), `${agent}: ${path} boundary missing`);
}
assert(robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`));
results.push({ check: "crawler-policies", groups: agents.length, result: "PASS" });

const { body: sitemap } = await get("/sitemap.xml");
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decode(match[1]));
assert(urls.length > 10);
assert.equal(new Set(urls).size, urls.length, "Duplicate sitemap URLs");
assert(urls.includes(`${canonicalOrigin}/company/faq`));
for (const value of urls) {
  const url = new URL(value);
  assert.equal(url.origin, canonicalOrigin);
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert(!blocked.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`)));
  assert(!["/trust/privacy", "/trust/security", "/products/recruitflow"].includes(url.pathname));
}
results.push({ check: "canonical-sitemap", urls: urls.length, result: "PASS" });

for (const path of ["/llms.txt", "/llms-full.txt", "/company/faq.md"]) {
  const { response, body } = await get(path);
  assert.match(response.headers.get("content-type") || "", path.endsWith(".md") ? /text\/markdown/ : /text\/plain/);
  assert(body.startsWith("# KRAVIA"));
  assert(!body.includes("<html"));
  assert(body.includes(canonicalOrigin));
  assert(!body.includes("https://kraviaprivatelimited.com"));
  assert(!body.includes("AANCK0043M"));
  for (const prefix of blocked) assert(!body.includes(`${canonicalOrigin}${prefix}/`));
  if (path !== "/llms.txt") {
    assert(body.includes("What is KRAVIA?"));
    assert(body.includes("not a claim of general availability"));
    assert(response.headers.get("link").includes(`${canonicalOrigin}/company/faq>; rel="canonical"`));
  }
  results.push({ check: "machine-readable-content", path, result: "PASS" });
}
assert(faqHtml.includes("/llms.txt"));

for (const agent of ["Googlebot", "bingbot", "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"]) {
  const { body } = await get("/", agent);
  assert(body.includes('"@type":"WebSite"'));
  assert(body.includes('"name":"KRAVIA"'));
  results.push({ check: "public-user-agent-response", agent, result: "PASS" });
}

console.log(JSON.stringify({ target: base.origin, checks: results.length, status: "PASS", results }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Search discovery smoke test\n\n**PASS** — ${results.length} checks on ${base.origin}.\n\nRendered canonicals, site name, preserved favicon, public FAQ/JSON-LD parity, crawler boundaries, canonical sitemap and text endpoints passed. User-agent checks are HTTP tests from this runner, not proof of a search engine's actual crawl or indexing.\n`);
