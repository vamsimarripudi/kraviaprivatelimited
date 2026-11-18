import { productReleaseNotes } from "./release-notes";

/** Escapes user-facing copy, so even future human-authored updates produce valid XML. */
export function escapeReleaseNotesXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function renderProductReleaseNotesRss(origin: string): string {
  const url = new URL("/products/release-notes", origin).toString();
  const items = [...productReleaseNotes].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
  const entries = items.map((item) => {
    const link = new URL("/products/release-notes#" + item.slug, origin).toString();
    const published = new Date(item.publishedOn + "T00:00:00Z").toUTCString();
    return [
      "<item>",
      "<title>" + escapeReleaseNotesXml(item.product + " — " + item.title) + "</title>",
      "<link>" + escapeReleaseNotesXml(link) + "</link>",
      "<guid isPermaLink=\"true\">" + escapeReleaseNotesXml(link) + "</guid>",
      "<pubDate>" + published + "</pubDate>",
      "<category>" + escapeReleaseNotesXml(item.type) + "</category>",
      "<description>" + escapeReleaseNotesXml(item.summary + " Availability: " + item.availability) + "</description>",
      "</item>",
    ].join("");
  }).join("");
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<rss version=\"2.0\"><channel>",
    "<title>KRAVIA Product Release Notes</title>",
    "<link>" + escapeReleaseNotesXml(url) + "</link>",
    "<description>Reviewed product changes, development progress and availability notes from KRAVIA PRIVATE LIMITED.</description>",
    "<language>en</language>",
    "<atom:link xmlns:atom=\"http://www.w3.org/2005/Atom\" href=\"" + escapeReleaseNotesXml(new URL("/products/release-notes/rss.xml", origin).toString()) + "\" rel=\"self\" type=\"application/rss+xml\"/>",
    entries,
    "</channel></rss>",
  ].join("");
}
