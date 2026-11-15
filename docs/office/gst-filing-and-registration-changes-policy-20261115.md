# KRAVIA Office — GST Filing and Registration Amendments

Policy decision — 15 November 2026: KRAVIA PRIVATE LIMITED is **not implementing e-invoicing/IRN operations at this stage**. The GST workspace should maintain returns, registration changes, notices, payments, evidence and purchase reconciliation.

## Filing and tax review

- **GST Portal remains the authoritative source** for registration status, actual return filing, filing ARN, GST REG-14 status, notices, orders and electronic ledgers.
- Maintain GSTR-1/GSTR-3B by tax period, filing frequency, CA review, authorised signatory, genuine ARN and return copy.
- Preserve relevant challans, tax ledgers, GSTR-2B evidence, supplier invoices, ITC review and any GST notice/response/closure order.
- Never claim a draft return is filed, or a GSTR-2B amount is eligible ITC without CA review.
- Return filing through Fynamics remains unavailable without approved provider credentials, taxpayer authorization and acceptance-tested workflow. Authorised signatories may file directly using the GST Portal instead.

## Registration changes

- Separate core and non-core REG-14 amendments. Core changes require official review where applicable; non-core changes can be auto-approved following successful filing.
- Review saved drafts in GST Portal > My Saved Applications, confirm the portal deadline, complete the correct form, and retain ARN and change evidence.
- At audit, 4 November core/non-core drafts had no later matching confirmation in the searched emails. This is **not proof they remain unsubmitted**.
- The 8 September 2026 GSTN order dropped cancellation proceedings and revoked suspension then; verify any later live status in the GST Portal.
- Review HDFC bank details on the GST registration if a bank-account amendment is required; this is independent of the HDFC Developer API.
- Review the notices/orders dashboard for new official actions.

## Current known filings

GSTN email acknowledgements confirm July through October 2026 GSTR-1 and GSTR-3B filings. Office `gst_return_workings` is currently empty; do not re-file those returns. Reconcile the filed ARNs and figures into the controlled record.

GSTN selected QRMP quarterly filing for January–March 2027, subject to the portal's current status and monthly payment obligations. Check frequency for each period rather than assuming all returns remain monthly.

## E-invoice boundary

- **Do not enable IRP/e-invoice creation or cancellation** in the Office workflow.
- Do not provision IRP credentials for the current filing-only scope.
- If statutory e-invoice requirements later apply, have the CA confirm applicability, then approve a separate governed implementation.
- Product SAC and tax invoice structure require separate documented professional review.

This PR changes the UI/policy scope; it does not perform statutory filing, amend registration, activate a provider, apply a database migration or alter company tax records.

Official guidance:
- https://tutorial.gst.gov.in/userguide/returns/manual_change_profile.htm
- https://tutorial.gst.gov.in/userguide/returns/FAQs_change_profile.htm
- https://tutorial.gst.gov.in/userguide/registration/Non-Core_Fields.htm
- https://www.gst.gov.in/
