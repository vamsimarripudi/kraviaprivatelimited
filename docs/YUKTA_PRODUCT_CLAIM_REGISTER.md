# YUKTA product claim register

Reviewed 2026-09-06. Internal evidence only; no raw product corpus is bundled publicly.

Source key C1: `F01_PRODUCT_CONSTITUTION.md`, Drive `12boRnipDZPtkE-IJB9ARgW2G4Q6Ndgyj` (governing draft).
Source key C2: `F03_V1_SCOPE_AND_EXCLUSIONS.md`, Drive `1B9NvKMdksIjaGYKKN3U_3VoatbkvAZWN` (V1 governing scope).
Source key C3: `00_PRODUCT_ORIENTATION.md`, Drive `1PdQ1CA9yEi3pDBYyYJuWpVaUqM3jKhWz`.
Source key C4: `YUKTA_MASTER_IMPLEMENTATION_TRACKER.md`, Drive `16EMY2OW3jCINOJvoWWh7LHN2XGJddrU0` (pre-build).
Source key C5: `YUKTA_MASTER_CODEX_CONSTITUTION.md`, Drive `1OC4Vi5Vz8zrENjf9WjZb1scEqH8oOPdI`.

| Claim ID | Capability / boundary | Source | Evidence state | Permitted wording / decision |
|---|---|---|---|---|
| YP01 | Clinics and small-hospital OPD, India | C1,C2,C3 | Documented design | Intended V1 scope, not full hospital ERP |
| YP02 | Appointments, arrival, queue, doctor availability | C1,C2 | Documented design | Designed to coordinate; no wait-time guarantee |
| YP03 | Paper consultation sheet, handwritten notes | C1,C2 | Documented design | Paper-first support; no forced doctor digital-entry claim |
| YP04 | Report readiness versus doctor review | C1,C2 | Documented design | Distinct states; authorized professionals retain authority |
| YP05 | Billing, payment verification, reconciliation | C1,C2 | Documented design | Intended coordinated workflow; no provider production activation asserted |
| YP06 | Hospital Web, Clinic, Patient surfaces | C1,C3 | Documented design | Planned roles; no store/device release claim |
| YP07 | English/Telugu | C1,C2 | Documented design | Required by design, not locally verified language QA |
| YP08 | Access isolation, roles, audit/document controls | C1,C5 | Documented design | Security principles, not certification or assurance |
| YP09 | Administrative AI | C1,C2 | Documented design | Optional bounded assistance; no diagnosis/prescribing/clinical interpretation |
| YP10 | ABDM/FHIR | C2 | Deferred / activation unverified | Future architecture direction, not live V1 |
| YP11 | Insurance, TPA, NHCX | C2 | Deferred | Explicitly excluded V1 |
| YP12 | Multi-facility, inpatient, ward/OT/nursing ERP | C2 | Deferred | Exclude from V1 availability |
| YP13 | Exports, imports, offline | C1,C2 | Documented design / exact release unverified | Bounded export direction; no universal migration/offline promise |
| YP14 | Availability | C4 | No release evidence verified | In development; no verified pilot or general availability |
| YP15 | Pricing/support | C1; no approved public commercial sheet | Not publishable as amounts/SLA | Contact Kravia; no price or response-time invented |
| YP16 | Measured outcomes | No pilot dataset | Not publishable | Intended mechanisms and proposed measurement only |

No product code, pilot, deployment or clinical validation was inspected for this corporate-page task. None of these records should be promoted to implemented/locally verified/pilot/production solely on website test results. Current public/legal approval is not established by this register. Shadow/Hospital Future Engine remains excluded. External metric IDs and public wording live in `lib/products/yukta-research.ts`; only reviewed public facts are rendered.
