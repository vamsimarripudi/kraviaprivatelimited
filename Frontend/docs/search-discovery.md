# KRAVIA search and AI discovery

## Identity and search result appearance

Preferred site name: **KRAVIA**. Alternative: **KRAVIA PRIVATE LIMITED**.
Canonical production origin: `https://www.kraviaprivatelimited.com`, matching the existing apex-to-www redirect. Preview deployments remain non-indexable. The existing favicon and company logo files are unchanged.

The homepage publishes one WebSite entity alongside the existing Corporation entity. Page-level metadata uses the same site name but distinct canonical URLs, titles and descriptions. Google's automated site-name system controls the actual label; these signals declare a preference, not an immediate guaranteed change.

## Public answer surfaces

- `/company/faq`: server-rendered questions, answers, public product descriptions and availability labels.
- `/company/faq.md`: the same content in Markdown, linked as an alternate with its HTML canonical.
- `/llms.txt`: concise reading index generated from approved public data.
- `/llms-full.txt`: expanded version of that public FAQ and product overview, not an export of private or internal data.

The HTML, FAQPage structured data and Markdown share the same functions. No invented reviews, offers, customer counts, certifications, launch dates or ranking promises are included. FAQPage markup describes visible content; it does not promise a Google rich result. llms.txt is an optional ecosystem convention, not registration with every assistant or a Google ranking factor.

## Crawling and privacy

Production allows public crawling by Googlebot, bingbot, Applebot, OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User, Claude-SearchBot, Claude-User and other agents through the existing wildcard policy. Each specific group repeats all private-route exclusions. Training-specific settings have not been added or changed. Some user-initiated fetchers do not apply robots.txt, so authentication and authorization remain the security boundary.

Sitemaps contain only public canonical URLs, deduplicate redirect aliases, honor published noindex decisions, reject external/query-bearing/private paths and use actual content modification dates. No artificial refresh timestamps are emitted.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` from Frontend. Search discovery quality additionally builds with `VERCEL_ENV=production`, starts the real Next.js server and runs `node scripts/search-smoke.mjs` against rendered HTTP responses. Its manual `production` target checks only the approved public custom domain without credentials. Requests with crawler user-agent strings are compatibility checks, not evidence that a real crawler visited, indexed or cited the site.

## Owner checks after deployment

In the verified Search Console property, inspect the homepage and `/company/faq`, test live URLs and request indexing. Submit or refresh `/sitemap.xml`. Confirm the property is included in Search generative AI features rather than excluded. Review Google's selected canonical, indexing status and eventual site-name display after recrawling. In Bing Webmaster Tools, inspect the same canonical domain and submit the same sitemap. These account-side actions require the relevant account access; a website deploy alone does not perform them.

Search Console access was unavailable through the connected GSC Wizard subscription during this release, so no account-side submission or inclusion-setting change is claimed.

## Primary references

- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.openai.com/api/docs/bots
- https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- https://docs.perplexity.ai/docs/resources/perplexity-crawlers
- https://llmstxt.org/
