# Calculations and measurement dictionary — internal

Checked 2026-09-06. Source endpoints and units: `lib/products/yukta-research.ts`. Implementation: `calculatedCagr`; checks: `tests/yukta-research.test.ts`.

Formula: `((forecast/base) ** (1/(forecastYear-baseYear)) - 1) * 100`.
India: 522.3 to 1049 USD million, 2024–2030, six intervals. Implied CAGR approximately 12.32%, versus publisher 12.6%. Investigation: publisher labels its growth period 2025–2030 but does not expose a matching 2025 base in the inspected summary. Cannot resolve with certainty. Select endpoints only; do not publish CAGR or modeled intermediate years.
Global: 13.81 to 20.75 USD billion, 2026–2031, five intervals, approximately 8.48%. Conversion to USD million is multiplication by 1000, not FX. Chart uses published endpoints only.
Facilities: 24,323 + 6,481 = 30,804. Release headline 30,800 is rounded; do not silently change either category.

## TAM / SAM / SOM decision

No numeric model published. Eligible unique buying entities, relevant annual software spend, approved YUKTA price, reachable segments, acquisition capacity, churn and time-active assumptions have not been verified. Broad PMS market is not YUKTA TAM. Do not substitute ABHA registrations or participating facilities for paying customers. Do not add overlapping clinic/HIS/EHR estimates. No confidential pricing hypothesis is reproduced.

When defensible inputs exist: annual segment TAM = non-overlapping buying entities × relevant annual software spend. SAM sums reachable V1-eligible segments. SOM requires explicit adoption, time active, discounts and churn; end-year ARR differs from revenue earned. Require approved sources and sensitivity before publication. No FX conversion or ROI calculator implemented.

## Future pilot measurement dictionary (not results)

| Measure | Definition / eligibility | Window, owner and comparison |
|---|---|---|
| Registration completion | Valid visit timestamp minus staff registration-start timestamp; exclude canceled/test/duplicate attempts; report completed count and completion rate separately | Per facility, agreed baseline week and pilot week; front-desk lead; median/P90, case-mix limitations |
| Waiting | Consultation-start minus checked-in timestamp; eligible attended OPD visits; no-shows excluded, interrupted visits separately reported | Same facility/doctor/session mix; operations owner; median/P90 and denominator |
| Follow-up completion | Completed eligible doctor-requested follow-ups / due eligible follow-ups; define grace period before collection; exclude rescinded orders | Monthly cohort; operations owner; baseline comparison, no clinical causality |
| Reconciliation age | Review timestamp minus first unmatched-payment timestamp; outstanding items reported separately from resolved | Daily snapshot; accounts owner; age distribution, no fake zero for absent records |
| Duplicate-entry incidence | Confirmed duplicate entries / eligible registration attempts; distinct from legitimate returning visits | Weekly adjudicated sample; data steward; documented matching method |
| Report status turnaround | Doctor-reviewed timestamp minus report-ready timestamp; only review-required eligible reports; pending censored separately | Monthly; authorized clinical lead; no claim of improved outcomes |

All baselines currently unavailable. Do not initialize charts with typical values. Capture only authorized data in a future pilot; never connect the corporate marketing site to patient records.
