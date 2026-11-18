import { renderProductReleaseNotesRss } from "@/lib/products/release-notes-feed";
import { siteUrl } from "@/lib/site";

export function GET() {
  return new Response(renderProductReleaseNotesRss(siteUrl), {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
