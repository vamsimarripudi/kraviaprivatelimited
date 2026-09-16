# Google Drive Evidence Integration

KRAVIA Office includes a read-only Google Drive metadata adapter so reviewed company evidence can be discovered without copying legal/private document bytes into Git.

## Security boundary

- Read-only Drive metadata scope only.
- No Drive write/delete endpoints.
- No document-content download in this adapter.
- No credentials, service-account keys, access tokens or private file contents are stored in business records or source control.
- Discovery requires authenticated KRAVIA Office roles and writes an Office audit event.
- Drive folder IDs and legal/shareholder identities are deployment/evidence data, not source-code constants.

## Expected KRAVIA Office evidence taxonomy

The readiness engine recognises these logical top-level areas by name:

1. `00 - Company Master`
2. `01 - Governance`
3. `02 - Compliance`
4. `03 - Finance & Accounting`
5. `04 - GST & Tax`
6. `05 - Banking & Payments`
7. `06 - Customers & Contracts`
8. `07 - Vendors & Procurement`
9. `08 - People & HR`

For each area Office reports `AVAILABLE`, `EMPTY`, or `MISSING_FOLDER`. This is evidence readiness only; an available file is not automatically treated as legally verified or approved.

The metadata audit also flags obvious taxonomy errors, including ownership/shareholding material filed under `06 - Customers & Contracts`. The software does not automatically move or rewrite Drive content.

## External configuration

Set these only in the deployment secret/configuration layer:

```bash
GOOGLE_DRIVE_ROOT_FOLDER_ID=<KRAVIA Office evidence folder id>
GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE=/run/secrets/google-drive-service-account.json
```

Share the approved Drive folder with the service-account client email using read permission. As a temporary development alternative, a short-lived `GOOGLE_DRIVE_ACCESS_TOKEN` can be supplied.

## Configuration readiness

```text
GET /api/v1/integrations/google-drive/readiness
```

This reports configuration state and the expected taxonomy without returning secret values.

## Metadata discovery

```text
POST /api/v1/integrations/google-drive/discover?max_depth=3&max_items=1000
```

The response contains only evidence metadata such as file/folder id, name, logical path, MIME type, size, modified time, web-view link and checksum when Google supplies one.

## Evidence readiness

```text
POST /api/v1/integrations/google-drive/evidence-readiness?max_depth=4&max_items=2000
```

This performs the bounded metadata scan and returns taxonomy coverage, empty/missing-area counts and filing warnings. It records only aggregate readiness information in the Office audit trail; document bytes are not downloaded.

The controlled company/shareholding bootstrap can store selected Drive evidence references in private deployment configuration. This keeps source code, legal evidence and statutory identity separate while allowing KRAVIA Office to trace operating records back to reviewed Drive evidence.
