# Source Evidence Policy

## Evidence boundary

The public Git repository contains no controlled corporate documents, personal records, bank details, mailbox exports, shareholder identity records or other private evidence. Those materials remain in authorized Office/private document stores. Source code contains only schemas, workflows, neutral templates and evidence references.

## Reviewed KRAVIA Office Drive taxonomy

The controlled Drive workspace reviewed for this build uses these logical areas:

- `00 - Company Master`
- `01 - Governance`
- `02 - Compliance`
- `03 - Finance & Accounting`
- `04 - GST & Tax`
- `05 - Banking & Payments`
- `06 - Customers & Contracts`
- `07 - Vendors & Procurement`
- `08 - People & HR`

The application has a read-only metadata readiness check for this taxonomy. It reports areas as `AVAILABLE`, `EMPTY` or `MISSING_FOLDER`; it does not download private bytes or treat file presence as legal approval.

At the time of the repository/Drive reconciliation, Company Master, Governance and GST/Tax had source material; Compliance, Finance & Accounting, Banking & Payments, Vendors & Procurement and People & HR were empty. Ownership/shareholding material was also detected under Customers & Contracts and is flagged as a filing/taxonomy issue for an authorized operator to correct. No private names, IDs, addresses or document contents from that material are committed here.

These observations are readiness facts, not statutory conclusions. The Drive state can change and must be rescanned before production bootstrap.

## Verification rule

An authorized operator must link current authoritative evidence before the relevant production master/record is marked verified. A document being present or linked does not itself prove filing, signing, approval, legal effectiveness or current statutory status.

Ownership/cap-table bootstrap must reconcile the authoritative current share register/certificates/agreement and applicable company records; historical proposal drafts must not be promoted as production truth.

## External communications

A deployed Office instance requires authorized Workspace/Gmail integration, least-privilege scopes and an evidence-retention decision before communication ingestion. No mailbox snapshots are committed to this repository.

## Authorized private evidence

Authorized operators may attach reviewed current evidence—such as incorporation/company-master records, governance packs, resolutions, statutory/tax records, contracts, vendor evidence and approved administration material—to the private document vault or approved Drive store. These files remain excluded from source control.

## Evidence policy

- Sensitive identifiers are minimized in normal UI and source-controlled fixtures.
- Current statutory/legal/ownership status must be linked to current authoritative evidence before production master lock.
- Google Drive integration is metadata-only/read-only; the software does not move files automatically.
- Evidence hashes/references may be recorded for traceability without copying controlled content into Git.
- Private documents and generated inspection packs remain outside source control.
- Empty evidence areas remain explicit gaps; Office must not fabricate completeness.
