"""Private KRAVIA Office file quarantine, malware scanning, and release.

Inbound Office files are uploaded to a non-public quarantine bucket by the
first-party backend. They are never considered usable until a background worker
streams the object through the private ClamAV daemon and promotes a clean copy to
the appropriate purpose-specific private bucket.

The module intentionally owns no browser-side Supabase authentication.
"""

from __future__ import annotations

import hashlib
import io
import json
import mimetypes
import os
import re
import socket
import struct
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import PurePath
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from .database import SessionLocal, get_db
from .storage_broker_client import configured as storage_broker_configured, delete_private, download_private, signed_download_url, upload_private

QUARANTINE_BUCKET = "office-quarantine"
MAX_FILE_BYTES = 50 * 1024 * 1024
SCAN_BATCH_DEFAULT = 10
SCAN_RETRY_LIMIT = 5
EICAR_TEST_BYTES = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
PRIVATE_FILE_SELF_TEST_BYTES = (
    b"%PDF-1.4\n"
    b"% KRAVIA PRIVATE FILE PIPELINE SELF TEST\n"
    b"1 0 obj\n<< /Type /Catalog >>\nendobj\n"
    b"trailer\n<<>>\n%%EOF\n"
)

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


def storage_configured() -> bool:
    return storage_broker_configured()


def scanner_configured() -> bool:
    return bool(os.getenv("CLAMAV_HOST", "").strip())


def file_security_ready() -> bool:
    return storage_configured() and scanner_configured()


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


def clamav_eicar_self_test() -> dict[str, Any]:
    """Prove the configured scanner detects the standard EICAR test signature.

    This sends the harmless industry-standard EICAR test string directly to
    ClamAV using the same INSTREAM protocol as real quarantine scans. No test
    payload is written to KRAVIA storage.
    """
    version = clamav_version()
    result = scan_bytes(EICAR_TEST_BYTES)
    if result["clean"]:
        raise RuntimeError("CLAMAV_EICAR_NOT_DETECTED")
    threat = str(result.get("threat") or "")
    if "eicar" not in threat.lower():
        raise RuntimeError("CLAMAV_EICAR_UNEXPECTED_SIGNATURE")
    return {
        "status": "PASSED",
        "scanner": "CLAMAV",
        "scanner_version": version,
        "threat": threat,
    }


def private_file_pipeline_self_test() -> dict[str, Any]:
    """Exercise private quarantine, clean scan, release, signed read-back, and cleanup.

    The test object is a tiny synthetic PDF under a randomized healthchecks/
    path. It never enters business tables and is deleted from both private
    buckets before the self-test returns successfully.
    """
    if not file_security_ready():
        raise RuntimeError("PRIVATE_FILE_PIPELINE_UNCONFIGURED")

    marker = uuid.uuid4().hex
    quarantine_path = f"healthchecks/{marker}/clean.pdf"
    released_path = f"healthchecks/{marker}/clean.pdf"
    payload = PRIVATE_FILE_SELF_TEST_BYTES
    payload_sha256 = hashlib.sha256(payload).hexdigest()

    quarantine_created = False
    release_created = False
    cleanup_ok = True
    result: dict[str, Any] | None = None

    try:
        upload_private(
            QUARANTINE_BUCKET,
            quarantine_path,
            payload,
            "application/pdf",
        )
        quarantine_created = True

        quarantined = download_private(QUARANTINE_BUCKET, quarantine_path, 30)
        if quarantined != payload:
            raise RuntimeError("PRIVATE_FILE_QUARANTINE_ROUNDTRIP_MISMATCH")

        scan = scan_bytes(quarantined)
        if not scan["clean"]:
            raise RuntimeError("PRIVATE_FILE_CLEAN_SAMPLE_REJECTED")

        upload_private(
            "office-documents",
            released_path,
            quarantined,
            "application/pdf",
        )
        release_created = True

        released = download_private("office-documents", released_path, 30)
        if released != payload:
            raise RuntimeError("PRIVATE_FILE_RELEASE_ROUNDTRIP_MISMATCH")

        signed_url = signed_download_url("office-documents", released_path, 15)
        if not signed_url.startswith("https://"):
            raise RuntimeError("PRIVATE_FILE_SIGNED_DOWNLOAD_INVALID")

        result = {
            "status": "PASSED",
            "quarantine_bucket": QUARANTINE_BUCKET,
            "release_bucket": "office-documents",
            "sha256": payload_sha256,
            "clean_scan": True,
            "signed_download_ttl_seconds": 15,
        }
    finally:
        if release_created and not delete_private("office-documents", released_path):
            cleanup_ok = False
        if quarantine_created and not delete_private(QUARANTINE_BUCKET, quarantine_path):
            cleanup_ok = False

    if not cleanup_ok:
        raise RuntimeError("PRIVATE_FILE_SELF_TEST_CLEANUP_FAILED")
    if result is None:
        raise RuntimeError("PRIVATE_FILE_SELF_TEST_INCOMPLETE")
    return result


def _retry_delay(attempts: int) -> timedelta:
    seconds = min(3600, 30 * (2 ** max(0, attempts - 1)))
    return timedelta(seconds=seconds)


def _claim_next_file(db: Session) -> Any | None:
    return db.execute(
        text(
            """
            select id,owner_user_id,purpose,context_type,context_id,context_metadata,
                   original_filename,detected_mime_type,byte_size,sha256,
                   quarantine_bucket,quarantine_path,target_bucket,scan_attempts
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


def _finalize_clean_context(db: Session, row: Any, released_path: str) -> dict[str, Any] | None:
    context_type = str(row.get("context_type") or "").strip().upper()
    if context_type != "DOCUMENT_SIGNATURE":
        return None

    metadata = row.get("context_metadata") or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError as exc:
            raise RuntimeError("SIGNATURE_CONTEXT_INVALID") from exc
    if not isinstance(metadata, dict):
        raise RuntimeError("SIGNATURE_CONTEXT_INVALID")

    required = {
        "instance_id",
        "render_id",
        "provider",
        "signature_method",
        "signed_at",
    }
    if any(not str(metadata.get(key) or "").strip() for key in required):
        raise RuntimeError("SIGNATURE_CONTEXT_INCOMPLETE")

    try:
        instance_id = str(uuid.UUID(str(metadata["instance_id"])))
        render_id = str(uuid.UUID(str(metadata["render_id"])))
        actor_id = str(uuid.UUID(str(row["owner_user_id"])))
    except (ValueError, TypeError, AttributeError) as exc:
        raise RuntimeError("SIGNATURE_CONTEXT_INVALID_ID") from exc

    evidence = metadata.get("evidence") or {}
    if not isinstance(evidence, dict):
        raise RuntimeError("SIGNATURE_EVIDENCE_INVALID")

    signature_id = db.execute(
        text(
            """
            select public.office_document_record_signature(
              cast(:actor as uuid),
              cast(:instance as uuid),
              cast(:render as uuid),
              :provider,
              :provider_reference,
              :method,
              :signer_masked,
              :storage,
              :sha,
              :size,
              cast(:signed_at as timestamptz),
              cast(:evidence as jsonb)
            )
            """
        ),
        {
            "actor": actor_id,
            "instance": instance_id,
            "render": render_id,
            "provider": str(metadata["provider"])[:100],
            "provider_reference": str(metadata.get("provider_reference") or "")[:500] or None,
            "method": str(metadata["signature_method"])[:40],
            "signer_masked": str(metadata.get("signer_reference_masked") or "")[:240] or None,
            "storage": released_path,
            "sha": row["sha256"],
            "size": int(row["byte_size"]),
            "signed_at": str(metadata["signed_at"]),
            "evidence": json.dumps(evidence, sort_keys=True, separators=(",", ":")),
        },
    ).scalar_one()
    _event(
        db,
        str(row["id"]),
        "WORKFLOW_CONTEXT_FINALIZED",
        engine="KRAVIA_OFFICE",
        result="SIGNED",
        detail={
            "context_type": "DOCUMENT_SIGNATURE",
            "document_instance_id": instance_id,
            "source_render_id": render_id,
            "signature_evidence_id": str(signature_id),
        },
    )
    return {"signature_evidence_id": str(signature_id)}


def _process_claimed_file(db: Session, row: Any, version: str) -> str:
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
        payload = download_private(row["quarantine_bucket"], row["quarantine_path"], 120)
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
                quarantine_deleted = delete_private(row["quarantine_bucket"], row["quarantine_path"])
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
        upload_private(
            row["target_bucket"],
            released_path,
            payload,
            row["detected_mime_type"],
        )
        try:
            context_result = _finalize_clean_context(db, row, released_path)
        except Exception:
            try:
                delete_private(row["target_bucket"], released_path)
            except Exception:
                pass
            raise

        quarantine_deleted = False
        try:
            quarantine_deleted = delete_private(row["quarantine_bucket"], row["quarantine_path"])
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
            detail={"target_bucket": row["target_bucket"], "released_path": released_path, "workflow_context": context_result},
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

    version = clamav_version()
    counters = {"clean": 0, "infected": 0, "failed": 0}
    examined = 0
    for _ in range(min(batch, int(queued))):
        with SessionLocal() as db:
            row = _claim_next_file(db)
            if not row:
                db.rollback()
                break
            result = _process_claimed_file(db, row, version)
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
        context_metadata: str | None = Form(default=None),
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

        context_payload: dict[str, Any] = {}
        if context_metadata and context_metadata.strip():
            if len(context_metadata.encode("utf-8")) > 16 * 1024:
                raise HTTPException(status_code=413, detail="File workflow metadata is too large")
            try:
                parsed_context = json.loads(context_metadata)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=422, detail="File workflow metadata must be valid JSON") from exc
            if not isinstance(parsed_context, dict):
                raise HTTPException(status_code=422, detail="File workflow metadata must be a JSON object")
            context_payload = parsed_context

        user_id = _actor_user_id(ctx)
        file_id = str(uuid.uuid4())
        digest = hashlib.sha256(data).hexdigest()
        quarantine_path = f"{normalized_purpose.lower()}/{file_id}/{normalized_name}"
        target_bucket = str(_PURPOSES[normalized_purpose]["bucket"])

        db.execute(
            text(
                """
                insert into office_file_objects(
                  id,owner_user_id,purpose,context_type,context_id,context_metadata,original_filename,
                  declared_mime_type,detected_mime_type,byte_size,sha256,
                  quarantine_bucket,quarantine_path,target_bucket,status
                ) values (
                  cast(:id as uuid),cast(:owner as uuid),:purpose,:context_type,:context_id,cast(:context_metadata as jsonb),:filename,
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
                "context_metadata": json.dumps(context_payload, sort_keys=True, separators=(",", ":")),
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
                "context_type": (context_type or "").strip()[:80] or None,
                "detected_mime_type": detected_mime,
                "byte_size": len(data),
                "sha256": digest,
            },
        )
        db.commit()

        try:
            upload_private(QUARANTINE_BUCKET, quarantine_path, data, detected_mime)
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
            url = signed_download_url(row["target_bucket"], row["released_path"], 60)
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Could not create private file access URL") from exc
        return {
            "file_id": str(row["id"]),
            "expires_in": 60,
            "url": url,
            "cache_control": "no-store",
        }

    return router
