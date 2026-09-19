"""Private KRAVIA Office file quarantine, malware scanning, and release.

Inbound Office files are uploaded to a non-public quarantine bucket by the
first-party backend. They are never considered usable until a background worker
streams the object through the private ClamAV daemon and promotes a clean copy to
the appropriate purpose-specific private bucket.

The module intentionally owns no browser-side Supabase authentication.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
import mimetypes
import os
import re
import socket
import time
import struct
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import PurePath
from typing import Any

import httpx

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from supabase import Client, create_client

from .database import SessionLocal, get_db

QUARANTINE_BUCKET = "office-quarantine"
MAX_FILE_BYTES = 50 * 1024 * 1024
SCAN_BATCH_DEFAULT = 10
SCAN_RETRY_LIMIT = 5

_PURPOSES: dict[str, dict[str, Any]] = {
    "CORPORATE": {
        "bucket": "corporate-private",
        "max_bytes": 20 * 1024 * 1024,
        "mimes": {
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    },
    "DOCUMENT": {
        "bucket": "office-documents",
        "max_bytes": 50 * 1024 * 1024,
        "mimes": {
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    },
    "CANDIDATE": {
        "bucket": "office-candidate-documents",
        "max_bytes": 25 * 1024 * 1024,
        "mimes": {
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
        },
    },
}

_MIME_EXTENSIONS = {
    "application/pdf": {".pdf"},
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {".docx"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {".xlsx"},
}

_UPLOAD_ROLES = (
    "OWNER",
    "DIRECTOR",
    "ADMIN",
    "FINANCE",
    "CA",
    "CS",
    "LEGAL",
    "HR",
    "OPERATIONS",
    "PRODUCT_ADMIN",
)
_READ_ROLES = _UPLOAD_ROLES + ("AUDITOR",)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _storage_url() -> str:
    return (
        os.getenv("SUPABASE_URL", "").strip()
        or os.getenv("SUPABASE_AUTH_URL", "").strip()
    )


def _publishable_key() -> str:
    return os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()


def _broker_url() -> str:
    return os.getenv("KRAVIA_STORAGE_BROKER_URL", "").strip()


def _broker_private_key() -> str:
    return os.getenv("KRAVIA_STORAGE_BROKER_PRIVATE_KEY", "").strip().replace("\\n", "\n")


def storage_configured() -> bool:
    return bool(_storage_url() and _publishable_key() and _broker_url() and _broker_private_key())


def scanner_configured() -> bool:
    return bool(os.getenv("CLAMAV_HOST", "").strip())


def file_security_ready() -> bool:
    return storage_configured() and scanner_configured()


def _storage_client() -> Client:
    url = _storage_url()
    publishable = _publishable_key()
    if not url or not publishable:
        raise RuntimeError("Supabase publishable storage client is not configured")
    return create_client(url, publishable)


def _broker_signature(timestamp: str, body: str) -> str:
    key_pem = _broker_private_key()
    if not key_pem:
        raise RuntimeError("KRAVIA storage broker signing key is not configured")
    key = serialization.load_pem_private_key(key_pem.encode("utf-8"), password=None)
    if not isinstance(key, ec.EllipticCurvePrivateKey):
        raise RuntimeError("KRAVIA storage broker key is invalid")
    der = key.sign((timestamp + "." + body).encode("utf-8"), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der)
    raw = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return base64.b64encode(raw).decode("ascii")


def _broker_request(action: str, **payload: Any) -> dict[str, Any]:
    url = _broker_url()
    if not url:
        raise RuntimeError("KRAVIA storage broker URL is not configured")
    body = json.dumps({"action": action, **payload}, sort_keys=True, separators=(",", ":"))
    timestamp = str(int(time.time()))
    signature = _broker_signature(timestamp, body)
    response = httpx.post(
        url,
        content=body.encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-kravia-timestamp": timestamp,
            "x-kravia-signature": signature,
        },
        timeout=float(os.getenv("KRAVIA_STORAGE_BROKER_TIMEOUT_SECONDS", "20")),
    )
    try:
        result = response.json()
    except ValueError as exc:
        raise RuntimeError("KRAVIA storage broker returned an invalid response") from exc
    if response.status_code >= 400:
        detail = result.get("code") or result.get("detail") or "BROKER_REQUEST_FAILED"
        raise RuntimeError(str(detail)[:160])
    return result


def _upload_signed(client: Client, bucket: str, path: str, data: bytes, mime: str) -> None:
    signed = _broker_request("signed_upload", bucket=bucket, path=path, upsert=False)
    token = str(signed.get("token") or "")
    if not token:
        raise RuntimeError("KRAVIA storage broker did not return an upload token")
    client.storage.from_(bucket).upload_to_signed_url(
        path=path,
        token=token,
        file=data,
        file_options={"content-type": mime, "cache-control": "private, max-age=0, no-store"},
    )


def _download_private(bucket: str, path: str) -> bytes:
    signed = _broker_request("signed_download", bucket=bucket, path=path, expires_in=120)
    url = str(signed.get("url") or "")
    if not url:
        raise RuntimeError("KRAVIA storage broker did not return a download URL")
    response = httpx.get(url, timeout=float(os.getenv("KRAVIA_STORAGE_DOWNLOAD_TIMEOUT_SECONDS", "30")))
    response.raise_for_status()
    return response.content


def _delete_private(bucket: str, path: str) -> None:
    _broker_request("delete", bucket=bucket, path=path)


def _file_table_present(db: Session) -> bool:
    bind = db.get_bind()
    schema = "public" if bind.dialect.name == "postgresql" else None
    return inspect(bind).has_table("office_file_objects", schema=schema)


def _normalize_filename(value: str | None) -> str:
    name = PurePath((value or "upload.bin").replace("\\", "/")).name
    name = re.sub(r"[^A-Za-z0-9._ -]+", "_", name).strip(" .")
    name = re.sub(r"\s+", "-", name)
    return (name[:180] or "upload.bin").lower()


def detect_mime(data: bytes) -> str:
    """Conservative content-based type detection for Office upload allowlists."""
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if len(data) >= 3 and data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = set(archive.namelist())
                if "[Content_Types].xml" not in names:
                    return "application/octet-stream"
                if any(name.startswith("word/") for name in names):
                    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                if any(name.startswith("xl/") for name in names):
                    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        except zipfile.BadZipFile:
            return "application/octet-stream"
    return "application/octet-stream"


def _validate_file(
    *,
    purpose: str,
    filename: str,
    declared_mime: str | None,
    data: bytes,
) -> tuple[str, str]:
    config = _PURPOSES[purpose]
    if not data:
        raise HTTPException(status_code=422, detail="The uploaded file is empty")
    if len(data) > int(config["max_bytes"]):
        raise HTTPException(status_code=413, detail="The uploaded file exceeds the allowed size")

    normalized = _normalize_filename(filename)
    detected = detect_mime(data)
    if detected not in config["mimes"]:
        raise HTTPException(status_code=415, detail="Unsupported or unrecognized file type")

    extension = PurePath(normalized).suffix.lower()
    if extension not in _MIME_EXTENSIONS.get(detected, set()):
        raise HTTPException(status_code=415, detail="File extension does not match the detected file type")

    declared = (declared_mime or "").split(";", 1)[0].strip().lower()
    if declared and declared not in {"application/octet-stream", detected}:
        raise HTTPException(status_code=415, detail="Declared content type does not match the uploaded file")

    return normalized, detected


def _actor_user_id(ctx: dict[str, Any]) -> str:
    raw = ctx.get("user_id") or ctx.get("subject")
    try:
        return str(uuid.UUID(str(raw)))
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(
            status_code=403,
            detail="A KRAVIA Office user identity is required for private file operations",
        ) from exc


def _can_read_file(ctx: dict[str, Any], owner_user_id: str) -> bool:
    actor_id = ctx.get("user_id") or ctx.get("subject")
    if actor_id and str(actor_id) == str(owner_user_id):
        return True
    roles = {str(role).upper() for role in (ctx.get("roles") or set())}
    return bool(roles & set(_READ_ROLES))


def _event(
    db: Session,
    file_id: str,
    event_type: str,
    *,
    engine: str | None = None,
    engine_version: str | None = None,
    result: str | None = None,
    threat_name: str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    db.execute(
        text(
            """
            insert into office_file_scan_events
              (file_id,event_type,engine,engine_version,result,threat_name,detail)
            values
              (cast(:file_id as uuid),:event_type,:engine,:engine_version,:result,:threat_name,cast(:detail as jsonb))
            """
        ),
        {
            "file_id": file_id,
            "event_type": event_type,
            "engine": engine,
            "engine_version": engine_version,
            "result": result,
            "threat_name": threat_name,
            "detail": json.dumps(detail or {}, sort_keys=True, separators=(",", ":")),
        },
    )


def _row_json(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "owner_user_id": str(row["owner_user_id"]),
        "purpose": row["purpose"],
        "context_type": row["context_type"],
        "context_id": row["context_id"],
        "original_filename": row["original_filename"],
        "detected_mime_type": row["detected_mime_type"],
        "byte_size": int(row["byte_size"]),
        "sha256": row["sha256"],
        "status": row["status"],
        "target_bucket": row["target_bucket"],
        "threat_name": row["threat_name"],
        "scan_attempts": int(row["scan_attempts"] or 0),
        "scanned_at": row["scanned_at"].isoformat() if row["scanned_at"] else None,
        "released_at": row["released_at"].isoformat() if row["released_at"] else None,
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


def _fetch_file(db: Session, file_id: str) -> Any:
    try:
        file_uuid = str(uuid.UUID(file_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="File record not found") from exc
    row = db.execute(
        text(
            """
            select id,owner_user_id,purpose,context_type,context_id,original_filename,
                   detected_mime_type,byte_size,sha256,status,target_bucket,released_path,
                   threat_name,scan_attempts,scanned_at,released_at,created_at
            from office_file_objects
            where id=cast(:id as uuid)
            """
        ),
        {"id": file_uuid},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="File record not found")
    return row


def _clamav_command(command: bytes, *, timeout: float = 15.0) -> str:
    host = os.getenv("CLAMAV_HOST", "").strip()
    port = int(os.getenv("CLAMAV_PORT", "3310"))
    if not host:
        raise RuntimeError("CLAMAV_HOST is not configured")
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        sock.sendall(command)
        chunks: list[bytes] = []
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            chunks.append(chunk)
            if b"\0" in chunk:
                break
    return b"".join(chunks).split(b"\0", 1)[0].decode("utf-8", errors="replace").strip()


def clamav_version() -> str:
    return _clamav_command(b"zVERSION\0", timeout=10.0)


def scan_bytes(data: bytes) -> dict[str, Any]:
    host = os.getenv("CLAMAV_HOST", "").strip()
    port = int(os.getenv("CLAMAV_PORT", "3310"))
    timeout = float(os.getenv("CLAMAV_SCAN_TIMEOUT_SECONDS", "45"))
    if not host:
        raise RuntimeError("CLAMAV_HOST is not configured")
    if len(data) > MAX_FILE_BYTES:
        raise RuntimeError("File exceeds KRAVIA malware scan ceiling")

    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.settimeout(timeout)
        sock.sendall(b"zINSTREAM\0")
        for start in range(0, len(data), 64 * 1024):
            chunk = data[start : start + 64 * 1024]
            sock.sendall(struct.pack("!I", len(chunk)))
            sock.sendall(chunk)
        sock.sendall(struct.pack("!I", 0))
        response = bytearray()
        while True:
            chunk = sock.recv(4096)
            if not chunk:
                break
            response.extend(chunk)
            if b"\0" in chunk:
                break

    message = bytes(response).split(b"\0", 1)[0].decode("utf-8", errors="replace").strip()
    if message.endswith(" OK"):
        return {"clean": True, "threat": None, "response": message}
    if message.endswith(" FOUND"):
        threat = message.split(":", 1)[-1].rsplit(" FOUND", 1)[0].strip()
        return {"clean": False, "threat": threat or "MALWARE_DETECTED", "response": message}
    raise RuntimeError(f"Unexpected ClamAV response: {message[:240]}")


def _retry_delay(attempts: int) -> timedelta:
    seconds = min(3600, 30 * (2 ** max(0, attempts - 1)))
    return timedelta(seconds=seconds)


def _claim_next_file(db: Session) -> Any | None:
    return db.execute(
        text(
            """
            select id,owner_user_id,purpose,original_filename,detected_mime_type,
                   byte_size,sha256,quarantine_bucket,quarantine_path,target_bucket,
                   scan_attempts
            from office_file_objects
            where (
              status='QUARANTINED'
              or (
                status='FAILED'
                and scan_attempts < :retry_limit
                and (next_scan_at is null or next_scan_at <= current_timestamp)
              )
            )
            order by coalesce(next_scan_at,created_at),created_at
            for update skip locked
            limit 1
            """
        ),
        {"retry_limit": SCAN_RETRY_LIMIT},
    ).mappings().first()


def _mark_failed(db: Session, row: Any, code: str) -> None:
    attempts = int(row["scan_attempts"] or 0) + 1
    terminal = attempts >= SCAN_RETRY_LIMIT
    db.execute(
        text(
            """
            update office_file_objects
            set status='FAILED',
                scan_attempts=:attempts,
                next_scan_at=:next_scan_at,
                last_error_code=:code,
                updated_at=current_timestamp
            where id=:id
            """
        ),
        {
            "id": row["id"],
            "attempts": attempts,
            "next_scan_at": None if terminal else _now() + _retry_delay(attempts),
            "code": code[:120],
        },
    )
    _event(
        db,
        str(row["id"]),
        "SCAN_FAILED",
        engine="CLAMAV",
        result="FAILED",
        detail={"error_code": code[:120], "attempt": attempts, "terminal": terminal},
    )


def _process_claimed_file(db: Session, row: Any, storage: Client, version: str) -> str:
    db.execute(
        text(
            """
            update office_file_objects
            set status='SCANNING',scan_attempts=scan_attempts+1,last_error_code=null,
                updated_at=current_timestamp
            where id=:id
            """
        ),
        {"id": row["id"]},
    )
    _event(db, str(row["id"]), "SCAN_STARTED", engine="CLAMAV", engine_version=version)
    db.commit()

    try:
        payload = _download_private(row["quarantine_bucket"], row["quarantine_path"])
        if len(payload) != int(row["byte_size"]):
            raise RuntimeError("SIZE_MISMATCH")
        if hashlib.sha256(payload).hexdigest() != row["sha256"]:
            raise RuntimeError("SHA256_MISMATCH")
        if detect_mime(payload) != row["detected_mime_type"]:
            raise RuntimeError("MIME_MISMATCH")

        result = scan_bytes(payload)
        if not result["clean"]:
            quarantine_deleted = False
            try:
                _delete_private(row["quarantine_bucket"], row["quarantine_path"])
                quarantine_deleted = True
            except Exception:
                # Detection is authoritative even when cleanup is temporarily
                # unavailable. The object remains private and unreleasable.
                quarantine_deleted = False
            db.execute(
                text(
                    """
                    update office_file_objects
                    set status='INFECTED',scan_engine='CLAMAV',scan_engine_version=:version,
                        threat_name=:threat,scanned_at=current_timestamp,
                        quarantine_deleted_at=case when :deleted then current_timestamp else quarantine_deleted_at end,
                        next_scan_at=null,last_error_code=null,updated_at=current_timestamp
                    where id=:id
                    """
                ),
                {
                    "id": row["id"],
                    "version": version[:200],
                    "threat": str(result["threat"])[:240],
                    "deleted": quarantine_deleted,
                },
            )
            _event(
                db,
                str(row["id"]),
                "MALWARE_DETECTED",
                engine="CLAMAV",
                engine_version=version,
                result="INFECTED",
                threat_name=str(result["threat"])[:240],
                detail={"quarantine_deleted": quarantine_deleted},
            )
            db.commit()
            return "INFECTED"

        date_path = _now().strftime("%Y/%m")
        released_path = f"scanned/{date_path}/{row['id']}/{row['original_filename']}"
        _upload_signed(
            storage,
            row["target_bucket"],
            released_path,
            payload,
            row["detected_mime_type"],
        )
        quarantine_deleted = False
        try:
            _delete_private(row["quarantine_bucket"], row["quarantine_path"])
            quarantine_deleted = True
        except Exception:
            quarantine_deleted = False
        db.execute(
            text(
                """
                update office_file_objects
                set status='CLEAN',scan_engine='CLAMAV',scan_engine_version=:version,
                    released_path=:released_path,scanned_at=current_timestamp,
                    released_at=current_timestamp,
                    quarantine_deleted_at=case when :deleted then current_timestamp else quarantine_deleted_at end,
                    next_scan_at=null,last_error_code=null,updated_at=current_timestamp
                where id=:id
                """
            ),
            {"id": row["id"], "version": version[:200], "released_path": released_path, "deleted": quarantine_deleted},
        )
        _event(
            db,
            str(row["id"]),
            "FILE_RELEASED",
            engine="CLAMAV",
            engine_version=version,
            result="CLEAN",
            detail={"target_bucket": row["target_bucket"], "released_path": released_path},
        )
        db.commit()
        return "CLEAN"
    except Exception as exc:
        db.rollback()
        fresh = db.execute(
            text("select id,scan_attempts from office_file_objects where id=:id for update"),
            {"id": row["id"]},
        ).mappings().first()
        if fresh:
            # SCANNING already incremented the attempt counter; compensate the
            # failure helper so one network attempt counts once.
            adjusted = dict(row)
            adjusted["scan_attempts"] = max(0, int(fresh["scan_attempts"] or 1) - 1)
            _mark_failed(db, adjusted, type(exc).__name__)
            db.commit()
        return "FAILED"


def process_file_scan_queue(limit: int | None = None) -> dict[str, Any]:
    batch = max(1, min(limit or int(os.getenv("KRAVIA_FILE_SCAN_BATCH_SIZE", str(SCAN_BATCH_DEFAULT))), 50))
    with SessionLocal() as probe:
        if not _file_table_present(probe):
            return {"status": "NOT_INSTALLED", "examined": 0, "clean": 0, "infected": 0, "failed": 0}
        queued = probe.execute(
            text(
                """
                select count(*)
                from office_file_objects
                where status='QUARANTINED'
                   or (status='FAILED' and scan_attempts < :retry_limit
                       and (next_scan_at is null or next_scan_at <= current_timestamp))
                """
            ),
            {"retry_limit": SCAN_RETRY_LIMIT},
        ).scalar_one()
    if not queued:
        return {"status": "IDLE", "examined": 0, "clean": 0, "infected": 0, "failed": 0}
    if not file_security_ready():
        return {
            "status": "UNCONFIGURED",
            "examined": 0,
            "queued": int(queued),
            "clean": 0,
            "infected": 0,
            "failed": 0,
        }

    storage = _storage_client()
    version = clamav_version()
    counters = {"clean": 0, "infected": 0, "failed": 0}
    examined = 0
    for _ in range(min(batch, int(queued))):
        with SessionLocal() as db:
            row = _claim_next_file(db)
            if not row:
                db.rollback()
                break
            result = _process_claimed_file(db, row, storage, version)
            examined += 1
            counters[result.lower()] += 1
    return {
        "status": "COMPLETED",
        "examined": examined,
        "scanner": "CLAMAV",
        "scanner_version": version,
        **counters,
    }


def build_file_security_router(get_db_dependency, actor_context_dependency):
    router = APIRouter(prefix="/api/v1/files", tags=["files"])

    def require_file_roles(*allowed_roles: str):
        allowed = {role.upper() for role in allowed_roles}

        def dependency(ctx=Depends(actor_context_dependency)):
            roles = {str(role).upper() for role in (ctx.get("roles") or set())}
            if not roles.intersection(allowed):
                raise HTTPException(status_code=403, detail="Insufficient Office authority")
            return ctx

        return dependency

    @router.get("/readiness")
    def readiness(_ctx=Depends(require_file_roles("OWNER", "DIRECTOR", "OPERATIONS", "AUDITOR"))):
        return {
            "configured": file_security_ready(),
            "private_storage_configured": storage_configured(),
            "malware_scanner_configured": scanner_configured(),
            "quarantine_bucket": QUARANTINE_BUCKET,
            "public_uploads": False,
            "release_requires_clean_scan": True,
        }

    @router.post("/upload", status_code=202)
    async def upload(
        purpose: str = Form(...),
        context_type: str | None = Form(default=None),
        context_id: str | None = Form(default=None),
        file: UploadFile = File(...),
        db: Session = Depends(get_db_dependency),
        ctx=Depends(require_file_roles(*_UPLOAD_ROLES)),
    ):
        if not _file_table_present(db):
            raise HTTPException(status_code=503, detail="Private file quarantine is not installed")
        if not file_security_ready():
            raise HTTPException(status_code=503, detail="Private file scanning is not ready")

        normalized_purpose = purpose.strip().upper()
        if normalized_purpose not in _PURPOSES:
            raise HTTPException(status_code=422, detail="Unknown file purpose")

        configured_max = int(_PURPOSES[normalized_purpose]["max_bytes"])
        data = await file.read(configured_max + 1)
        normalized_name, detected_mime = _validate_file(
            purpose=normalized_purpose,
            filename=file.filename or "upload.bin",
            declared_mime=file.content_type,
            data=data,
        )

        user_id = _actor_user_id(ctx)
        file_id = str(uuid.uuid4())
        digest = hashlib.sha256(data).hexdigest()
        quarantine_path = f"{normalized_purpose.lower()}/{file_id}/{normalized_name}"
        target_bucket = str(_PURPOSES[normalized_purpose]["bucket"])

        db.execute(
            text(
                """
                insert into office_file_objects(
                  id,owner_user_id,purpose,context_type,context_id,original_filename,
                  declared_mime_type,detected_mime_type,byte_size,sha256,
                  quarantine_bucket,quarantine_path,target_bucket,status
                ) values (
                  cast(:id as uuid),cast(:owner as uuid),:purpose,:context_type,:context_id,:filename,
                  :declared_mime,:detected_mime,:byte_size,:sha256,
                  :quarantine_bucket,:quarantine_path,:target_bucket,'UPLOADING'
                )
                """
            ),
            {
                "id": file_id,
                "owner": user_id,
                "purpose": normalized_purpose,
                "context_type": (context_type or "").strip()[:80] or None,
                "context_id": (context_id or "").strip()[:160] or None,
                "filename": normalized_name,
                "declared_mime": (file.content_type or "").split(";", 1)[0].strip().lower() or None,
                "detected_mime": detected_mime,
                "byte_size": len(data),
                "sha256": digest,
                "quarantine_bucket": QUARANTINE_BUCKET,
                "quarantine_path": quarantine_path,
                "target_bucket": target_bucket,
            },
        )
        _event(
            db,
            file_id,
            "UPLOAD_ACCEPTED",
            result="UPLOADING",
            detail={
                "purpose": normalized_purpose,
                "detected_mime_type": detected_mime,
                "byte_size": len(data),
                "sha256": digest,
            },
        )
        db.commit()

        try:
            _upload_signed(
                _storage_client(),
                QUARANTINE_BUCKET,
                quarantine_path,
                data,
                detected_mime,
            )
            db.execute(
                text(
                    """
                    update office_file_objects
                    set status='QUARANTINED',updated_at=current_timestamp
                    where id=cast(:id as uuid)
                    """
                ),
                {"id": file_id},
            )
            _event(db, file_id, "QUARANTINED", result="PENDING_SCAN")
            db.commit()
        except Exception as exc:
            db.rollback()
            db.execute(
                text(
                    """
                    update office_file_objects
                    set status='FAILED',last_error_code=:code,updated_at=current_timestamp
                    where id=cast(:id as uuid)
                    """
                ),
                {"id": file_id, "code": type(exc).__name__[:120]},
            )
            _event(
                db,
                file_id,
                "UPLOAD_FAILED",
                result="FAILED",
                detail={"error_code": type(exc).__name__},
            )
            db.commit()
            raise HTTPException(status_code=503, detail="Private quarantine upload failed") from exc

        return {
            "file_id": file_id,
            "status": "QUARANTINED",
            "purpose": normalized_purpose,
            "detected_mime_type": detected_mime,
            "byte_size": len(data),
            "sha256": digest,
            "scan_required": True,
        }

    @router.get("/{file_id}")
    def status(
        file_id: str,
        db: Session = Depends(get_db_dependency),
        ctx=Depends(require_file_roles(*_READ_ROLES)),
    ):
        row = _fetch_file(db, file_id)
        if not _can_read_file(ctx, str(row["owner_user_id"])):
            raise HTTPException(status_code=403, detail="File access is not permitted")
        return _row_json(row)

    @router.get("/{file_id}/download-url")
    def download_url(
        file_id: str,
        db: Session = Depends(get_db_dependency),
        ctx=Depends(require_file_roles(*_READ_ROLES)),
    ):
        row = _fetch_file(db, file_id)
        if not _can_read_file(ctx, str(row["owner_user_id"])):
            raise HTTPException(status_code=403, detail="File access is not permitted")
        if row["status"] != "CLEAN" or not row["released_path"]:
            raise HTTPException(status_code=409, detail="File is not available until malware scanning passes")
        if not storage_configured():
            raise HTTPException(status_code=503, detail="Private storage is unavailable")
        try:
            signed = _broker_request(
                "signed_download",
                bucket=row["target_bucket"],
                path=row["released_path"],
                expires_in=60,
            )
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Could not create private file access URL") from exc
        url = str(signed.get("url") or "")
        if not url:
            raise HTTPException(status_code=503, detail="Could not create private file access URL")
        return {
            "file_id": str(row["id"]),
            "expires_in": int(signed.get("expires_in") or 60),
            "url": url,
            "cache_control": "no-store",
        }

    return router
