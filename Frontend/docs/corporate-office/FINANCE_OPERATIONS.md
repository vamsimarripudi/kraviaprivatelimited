# Finance operations

Finance is an evidence and reconciliation workspace, not accounting software or a payment-execution product. Bank credentials, PINs, OTPs and private banking tokens are never stored.

CSV statements are staged first. They are parsed and validated, likely duplicates are flagged, and an authorised finance user must resolve every duplicate/invalid row before the atomic confirmation function creates transactions. Source descriptions are retained. XLSX/PDF parsing is intentionally disabled until an approved isolated parser and file-malware controls are configured.

Reconciliation suggestions require human confirmation. Director/shareholder transactions require explicit classification and professional review where appropriate.
