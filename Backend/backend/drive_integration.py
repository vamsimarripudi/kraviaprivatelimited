"""Read-only Google Drive evidence discovery for KRAVIA Office.

The adapter is deliberately metadata-only: it never writes to Drive and never
copies private document bytes into source control. Credentials remain external.
The readiness layer understands the expected KRAVIA Office evidence taxonomy
without hard-coding private Drive IDs or document contents.
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Callable, Optional

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .services import audit

DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_METADATA_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly"

EXPECTED_EVIDENCE_AREAS = (
    "00 - Company Master",
    "01 - Governance",
    "02 - Compliance",
    "03 - Finance & Accounting",
    "04 - GST & Tax",
    "05 - Banking & Payments",
    "06 - Customers & Contracts",
    "07 - Vendors & Procurement",
    "08 - People & HR",
)


class GoogleDriveAdapter:
    def __init__(self):
        self.root_folder_id = os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
        self.access_token = os.getenv("GOOGLE_DRIVE_ACCESS_TOKEN", "").strip()
        self.service_account_file = os.getenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE", "").strip()
        self.timeout = float(os.getenv("GOOGLE_DRIVE_TIMEOUT_SECONDS", "20"))
        self._cached_token: Optional[str] = None
        self._cached_until = 0.0

    def readiness(self) -> dict:
        auth_mode = "ACCESS_TOKEN" if self.access_token else "SERVICE_ACCOUNT" if self.service_account_file else "NOT_CONFIGURED"
        return {
            "configured": bool(self.root_folder_id and (self.access_token or self.service_account_file)),
            "root_folder_configured": bool(self.root_folder_id),
            "auth_mode": auth_mode,
            "mode": "READ_ONLY_METADATA",
            "scope": DRIVE_METADATA_SCOPE,
            "content_download_enabled": False,
            "write_enabled": False,
            "expected_evidence_areas": list(EXPECTED_EVIDENCE_AREAS),
        }

    def _service_account_token(self) -> str:
        now = time.time()
        if self._cached_token and now < self._cached_until - 60:
            return self._cached_token
        path = Path(self.service_account_file)
        if not path.exists():
            raise RuntimeError("Google Drive service-account file is unavailable")
        data = json.loads(path.read_text(encoding="utf-8"))
        for key in ("client_email", "private_key"):
            if not data.get(key):
                raise RuntimeError(f"Google Drive service-account file is missing {key}")
        token_uri = data.get("token_uri") or "https://oauth2.googleapis.com/token"
        issued = int(now)
        assertion = jwt.encode(
            {
                "iss": data["client_email"],
                "scope": DRIVE_METADATA_SCOPE,
                "aud": token_uri,
                "iat": issued,
                "exp": issued + 3600,
            },
            data["private_key"],
            algorithm="RS256",
        )
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.post(token_uri, data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": assertion,
                })
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise RuntimeError("Google Drive service-account token exchange failed") from exc
        token = str(payload.get("access_token") or "")
        if not token:
            raise RuntimeError("Google Drive token response did not contain access_token")
        self._cached_token = token
        self._cached_until = now + int(payload.get("expires_in") or 3600)
        return token

    def token(self) -> str:
        if self.access_token:
            return self.access_token
        if self.service_account_file:
            return self._service_account_token()
        raise RuntimeError("Google Drive authentication is not configured")

    def _get(self, path: str, params: dict) -> dict:
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(f"{DRIVE_API}/{path}", params=params, headers={"Authorization": f"Bearer {self.token()}"})
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in {401, 403}:
                raise RuntimeError("Google Drive authorization failed or scope/folder access is insufficient") from exc
            raise RuntimeError(f"Google Drive API returned HTTP {status}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise RuntimeError("Google Drive API request failed") from exc

    def list_children(self, folder_id: str) -> list[dict]:
        fields = "nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,md5Checksum,parents)"
        page_token: Optional[str] = None
        rows: list[dict] = []
        while True:
            params = {
                "q": f"'{folder_id}' in parents and trashed = false",
                "fields": fields,
                "pageSize": "1000",
                "orderBy": "folder,name_natural",
                "supportsAllDrives": "true",
                "includeItemsFromAllDrives": "true",
            }
            if page_token:
                params["pageToken"] = page_token
            payload = self._get("files", params)
            rows.extend(payload.get("files") or [])
            page_token = payload.get("nextPageToken")
            if not page_token:
                return rows

    def discover(self, max_depth: int = 3, max_items: int = 1000) -> list[dict]:
        if not self.root_folder_id:
            raise RuntimeError("GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured")
        if max_depth < 0 or max_depth > 8:
            raise ValueError("max_depth must be between 0 and 8")
        if max_items < 1 or max_items > 5000:
            raise ValueError("max_items must be between 1 and 5000")
        folder_mime = "application/vnd.google-apps.folder"
        queue: list[tuple[str, str, int]] = [(self.root_folder_id, "", 0)]
        result: list[dict] = []
        seen = {self.root_folder_id}
        while queue and len(result) < max_items:
            folder_id, parent_path, depth = queue.pop(0)
            for item in self.list_children(folder_id):
                name = str(item.get("name") or "")
                path = f"{parent_path}/{name}" if parent_path else name
                row = {
                    "id": item.get("id"),
                    "name": name,
                    "path": path,
                    "mime_type": item.get("mimeType"),
                    "size": item.get("size"),
                    "modified_time": item.get("modifiedTime"),
                    "web_view_link": item.get("webViewLink"),
                    "md5_checksum": item.get("md5Checksum"),
                    "is_folder": item.get("mimeType") == folder_mime,
                }
                result.append(row)
                if len(result) >= max_items:
                    break
                child_id = str(item.get("id") or "")
                if row["is_folder"] and depth < max_depth and child_id and child_id not in seen:
                    seen.add(child_id)
                    queue.append((child_id, path, depth + 1))
        return result


def build_evidence_readiness(items: list[dict], truncated: bool = False) -> dict:
    """Map Drive metadata to the controlled KRAVIA Office evidence taxonomy."""
    top_folders = {row["path"]: row for row in items if row.get("is_folder") and "/" not in str(row.get("path") or "")}
    areas = []
    for area in EXPECTED_EVIDENCE_AREAS:
        folder = top_folders.get(area)
        prefix = area + "/"
        descendants = [row for row in items if str(row.get("path") or "").startswith(prefix)]
        files = [row for row in descendants if not row.get("is_folder")]
        folders = [row for row in descendants if row.get("is_folder")]
        state = "MISSING_FOLDER" if folder is None else "AVAILABLE" if files else "EMPTY"
        areas.append({
            "area": area,
            "state": state,
            "file_count": len(files),
            "subfolder_count": len(folders),
        })

    warnings = []
    for row in items:
        if row.get("is_folder"):
            continue
        path = str(row.get("path") or "")
        name = str(row.get("name") or "").lower()
        if path.startswith("06 - Customers & Contracts/") and any(token in name for token in ("shareholder", "shareholding", "cap table", "share register")):
            warnings.append({
                "code": "OWNERSHIP_EVIDENCE_MISFILED",
                "path": path,
                "recommended_area": "00 - Company Master or 01 - Governance",
            })

    missing = sum(1 for row in areas if row["state"] == "MISSING_FOLDER")
    empty = sum(1 for row in areas if row["state"] == "EMPTY")
    available = sum(1 for row in areas if row["state"] == "AVAILABLE")
    if truncated:
        readiness = "INCOMPLETE_SCAN"
    elif missing:
        readiness = "MISSING_AREAS"
    elif empty or warnings:
        readiness = "READY_WITH_GAPS"
    else:
        readiness = "READY"
    return {
        "readiness": readiness,
        "available_areas": available,
        "empty_areas": empty,
        "missing_areas": missing,
        "areas": areas,
        "warnings": warnings,
        "content_downloaded": False,
    }


def build_google_drive_router(get_db: Callable, require_roles: Callable) -> APIRouter:
    router = APIRouter(prefix="/api/v1/integrations/google-drive", tags=["google-drive"])

    @router.get("/readiness")
    def readiness(ctx=Depends(require_roles("OWNER", "DIRECTOR", "OPERATIONS", "AUDITOR", "CA", "CS"))):
        return GoogleDriveAdapter().readiness()

    @router.post("/discover")
    def discover(
        max_depth: int = Query(default=3, ge=0, le=8),
        max_items: int = Query(default=1000, ge=1, le=5000),
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "DIRECTOR", "OPERATIONS", "AUDITOR", "CA", "CS")),
    ):
        adapter = GoogleDriveAdapter()
        if not adapter.readiness()["configured"]:
            raise HTTPException(409, "Google Drive evidence source is not configured")
        try:
            items = adapter.discover(max_depth=max_depth, max_items=max_items)
        except (RuntimeError, ValueError) as exc:
            raise HTTPException(502, str(exc)) from exc
        audit(db, ctx["actor"], ctx["role"], "integration.google_drive.discovered", "integration", "GOOGLE_DRIVE", {
            "item_count": len(items), "max_depth": max_depth, "max_items": max_items,
            "content_downloaded": False,
        }, "CONTROL")
        db.commit()
        return {
            "root_folder_id": adapter.root_folder_id,
            "item_count": len(items),
            "truncated": len(items) >= max_items,
            "items": items,
            "mode": "READ_ONLY_METADATA",
        }

    @router.post("/evidence-readiness")
    def evidence_readiness(
        max_depth: int = Query(default=4, ge=1, le=8),
        max_items: int = Query(default=2000, ge=1, le=5000),
        db: Session = Depends(get_db),
        ctx=Depends(require_roles("OWNER", "DIRECTOR", "OPERATIONS", "AUDITOR", "CA", "CS")),
    ):
        adapter = GoogleDriveAdapter()
        if not adapter.readiness()["configured"]:
            raise HTTPException(409, "Google Drive evidence source is not configured")
        try:
            items = adapter.discover(max_depth=max_depth, max_items=max_items)
        except (RuntimeError, ValueError) as exc:
            raise HTTPException(502, str(exc)) from exc
        result = build_evidence_readiness(items, truncated=len(items) >= max_items)
        audit(db, ctx["actor"], ctx["role"], "integration.google_drive.evidence_readiness", "integration", "GOOGLE_DRIVE", {
            "readiness": result["readiness"],
            "available_areas": result["available_areas"],
            "empty_areas": result["empty_areas"],
            "missing_areas": result["missing_areas"],
            "warning_count": len(result["warnings"]),
            "content_downloaded": False,
        }, "CONTROL")
        db.commit()
        return result

    return router
