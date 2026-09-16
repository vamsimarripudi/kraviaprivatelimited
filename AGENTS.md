# KRAVIA repository rules

## Structure

- Work on the Next.js application from `Frontend/`.
- Work on the Python/FastAPI Office service from `Backend/`.
- Keep database project files and migrations under `Database/`.
- Do not move provider credentials, generated caches, local databases, build outputs or virtual environments into Git.

## Quality

Before considering a change complete, run the relevant lint/type/test/build or backend quality gates. Fix actionable warnings at source; do not silence them merely to obtain a green build.

## Next.js

This repository uses Next.js 16. For Next.js changes, work from `Frontend/` and read the installed documentation under `Frontend/node_modules/next/dist/docs/` before relying on older framework conventions. Heed deprecation notices and preserve server/client boundaries.
