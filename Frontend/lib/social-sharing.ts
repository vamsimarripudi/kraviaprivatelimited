/** Share a public article, never a corporate profile or the reader's query string. */
export function createArticleShareLinks(canonicalUrl: string, title: string) {
  const url = new URL(canonicalUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError("Article sharing requires an HTTP(S) URL.");
  }
  const href = url.toString();
  return [
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: href })}` },
    { key: "x", label: "X", href: `https://twitter.com/intent/tweet?${new URLSearchParams({ url: href, text: title })}` },
    { key: "linkedIn", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url: href })}` },
  ] as const;
}
