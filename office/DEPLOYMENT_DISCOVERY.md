# Deployment Discovery — 12 Sep 2026

## Vercel
A connected Vercel team is available and contains existing KRAVIA-adjacent/product deployments, including several VidyaLuma projects. No dedicated `kravia-office` project was present in the discovered project list.

**Decision:** do not modify an unrelated product project to host KRAVIA Office. Office should receive a dedicated project and production environment.

## GitHub
The connected GitHub connector currently returned no accessible repositories. Existing Vercel metadata references product repositories, but that does not grant this build process permission to write to them.

**Decision:** no repository was modified. When a dedicated KRAVIA Office repository becomes accessible, import this project and preserve history.

## Domain
Target remains:

`office.kraviaprivatelimited.com`

DNS is not changed in this package because a dedicated production project, identity layer and security gates must exist before cutover.
