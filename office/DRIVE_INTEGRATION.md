# Google Drive Evidence Integration

KRAVIA Office includes a read-only Google Drive metadata adapter so reviewed company evidence can be discovered without copying legal/private document bytes into Git.

## Security boundary

- Read-only Drive metadata scope only.
- No Drive write/delete endpoints.
- No document-content download in this adapter.
- No credentials, service-account keys, access tokens or private file contents are stored in business records or source control.
- Discovery requires authenticated KRAVIA Office roles and writes an Office audit event.

## External configuration

Set these only in the deployment secret/configuration layer:

```bash
GOOGLE_DRIVE_ROOT_FOLDER_ID=<KRAVIA Office evidence folder id>
GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE=/run/secrets/google-drive-service-account.json
```

Share the approved Drive folder with the service-account client email using read permission. As a temporary development alternative, a short-lived `GOOGLE_DRIVE_ACCESS_TOKEN` can be supplied.

## Readiness

```text
GET /api/v1/integrations/google-drive/readiness
```

This reports configuration state without returning secret values.

## Discovery

```text
POST /api/v1/integrations/google-drive/discover?max_depth=3&max_items=1000
```

The response contains only evidence metadata such as file/folder id, name, logical path, MIME type, size, modified time, web-view link and checksum when Google supplies one. The controlled company/shareholding bootstrap can then store the selected Drive evidence reference in `config/company-master.local.json`.

This keeps source code, legal evidence and statutory identity separate while allowing KRAVIA Office to trace operating records back to reviewed Drive evidence.
