# Content platform architecture

Phase 5B adds a focused corporate publishing layer, not a generic CMS. `content_records` is the canonical publication record; `content_versions`, `content_reviews`, claims, corporate facts, relationships, assets, redirects and link checks are supporting governed records.

Public pages query only `PUBLISHED` + `PUBLIC` records through `lib/content/repository.ts`. Drafts, evidence, comments and private records remain behind Corporate Office RLS. Static company narrative remains version-controlled as a resilient fallback.

Publishing revalidates the homepage, Newsroom, article path and sitemap. Scheduled releases use the existing authenticated internal scheduler.
