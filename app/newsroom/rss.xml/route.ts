import { getPublishedNewsroomContent } from "@/lib/content/repository";
import { contentPath } from "@/lib/content/seo";
import { siteUrl } from "@/lib/site";

function escapeXml(value: string) { return value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character] ?? character); }
export async function GET() {
  const articles = await getPublishedNewsroomContent();
  const items = articles.map((article) => `<item><title>${escapeXml(article.title)}</title><link>${escapeXml(new URL(contentPath(article), siteUrl).toString())}</link><guid isPermaLink="true">${escapeXml(new URL(contentPath(article), siteUrl).toString())}</guid><description>${escapeXml(article.summary ?? "")}</description><pubDate>${article.publishedAt ? new Date(article.publishedAt).toUTCString() : ""}</pubDate><author>${escapeXml(article.authorName ?? "KRAVIA PRIVATE LIMITED")}</author></item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Kravia Newsroom</title><link>${escapeXml(siteUrl)}</link><description>Official updates from KRAVIA PRIVATE LIMITED.</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" } });
}