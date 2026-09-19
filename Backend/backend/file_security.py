"""Private KRAVIA file-malware screening.

Untrusted files are screened in memory through the private Railway ClamAV
service before any application storage write. The endpoint is intentionally
excluded from the public OpenAPI contract because it is a BFF-internal security
boundary, not a customer-facing file service.
"""
from __future__ import annotations

import asyncio
import hashlib
import os
import socket
import struct
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .services import audit


class MalwareScannerUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class MalwareScanResult:
    clean: bool
    signature: str | None
    raw_status: str


def _max_bytes() -> int:
    try:
        value = int(os.getenv("OFFICE_FILE_SCAN_MAX_BYTES", str(25 * 1024 * 1024)))
    except ValueError:
        value = 25 * 1024 * 1024
    return max(1, min(value, 50 * 1024 * 1024))


def _timeout_seconds() -> float:
    try:
        value = float(os.getenv("OFFICE_FILE_SCAN_TIMEOUT_SECONDS", "30"))
    except ValueError:
        value = 30.0
    return max(1.0, min(value, 120.0))


def _parse_clamav_response(payload: bytes) -> MalwareScanResult:
    message = payload.rstrip(b"\x00\r\n").decode("utf-8", errors="replace").strip()
    if message.endswith(": OK") or message == "stream: OK":
        return MalwareScanResult(clean=True, signature=None, raw_status="OK")
    if message.endswith(" FOUND"):
        prefix = message.rsplit(" FOUND", 1)[0]
        signature = prefix.split(":", 1)[1].strip() if ":" in prefix else "DETECTED"
        return MalwareScanResult(clean=False, signature=signature[:240], raw_status="FOUND")
    if "ERROR" in message.upper():
        raise MalwareScannerUnavailable("ClamAV returned an error")
    raise MalwareScannerUnavailable("ClamAV returned an unrecognised response")


def scan_bytes_with_clamav(content: bytes) -> MalwareScanResult:
    host = os.getenv("CLAMAV_HOST", "").strip()
    if not host:
        raise MalwareScannerUnavailable("CLAMAV_HOST is not configured")
    try:
        port = int(os.getenv("CLAMAV_PORT", "3310"))
    except ValueError:
        port = 3310
    timeout = _timeout_seconds()

    try:
        with socket.create_connection((host, port), timeout=timeout) as client:
            client.settimeout(timeout)
            client.sendall(b"zINSTREAM\x00")
            for offset in range(0, len(content), 64 * 1024):
                chunk = content[offset:offset + 64 * 1024]
                client.sendall(struct.pack("!I", len(chunk)))
                client.sendall(chunk)
            client.sendall(struct.pack("!I", 0))

            response = bytearray()
            while len(response) < 4096:
                block = client.recv(1024)
                if not block:
                    break
                response.extend(block)
                if b"\x00" in block:
                    break
    except (OSError, TimeoutError) as exc:
        raise MalwareScannerUnavailable("Private malware scanner is unavailable") from exc

    if not response:
        raise MalwareScannerUnavailable("Private malware scanner returned no result")
    return _parse_clamav_response(bytes(response))


async def _bounded_body(request: Request) -> bytes:
    limit = _max_bytes()
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > limit:
                raise HTTPException(status_code=413, detail="File exceeds malware-scan limit")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length")

    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > limit:
            raise HTTPException(status_code=413, detail="File exceeds malware-scan limit")
    if not body:
        raise HTTPException(status_code=400, detail="File is empty")
    return bytes(body)


def build_file_security_router(get_db, actor_dependency) -> APIRouter:
    router = APIRouter(prefix="/api/v1/security", tags=["security"])

    @router.post("/file-scan", include_in_schema=False)
    async def file_scan(
        request: Request,
        db: Session = Depends(get_db),
        ctx=Depends(actor_dependency),
    ):
        content = await _bounded_body(request)
        digest = hashlib.sha256(content).hexdigest()
        mime = (request.headers.get("content-type") or "application/octet-stream").split(";", 1)[0][:160]

        try:
            result = await asyncio.to_thread(scan_bytes_with_clamav, content)
        except MalwareScannerUnavailable as exc:
            audit(
                db,
                ctx.get("actor") or "unknown",
                ctx.get("role") or "UNKNOWN",
                "security.file_scan.unavailable",
                "file_scan",
                digest,
                {"sha256": digest, "size_bytes": len(content), "mime_type": mime},
                "HIGH",
            )
            db.commit()
            raise HTTPException(
                status_code=503,
                detail="File security scan is temporarily unavailable; file was not accepted",
            ) from exc

        if not result.clean:
            audit(
                db,
                ctx.get("actor") or "unknown",
                ctx.get("role") or "UNKNOWN",
                "security.file_scan.rejected",
                "file_scan",
                digest,
                {
                    "sha256": digest,
                    "size_bytes": len(content),
                    "mime_type": mime,
                    "scanner": "CLAMAV",
                    "signature": result.signature,
                },
                "HIGH",
            )
            db.commit()
            raise HTTPException(status_code=422, detail="File was rejected by malware protection")

        audit(
            db,
            ctx.get("actor") or "unknown",
            ctx.get("role") or "UNKNOWN",
            "security.file_scan.clean",
            "file_scan",
            digest,
            {
                "sha256": digest,
                "size_bytes": len(content),
                "mime_type": mime,
                "scanner": "CLAMAV",
            },
            "INFO",
        )
        db.commit()
        return {
            "clean": True,
            "status": "CLEAN",
            "scanner": "CLAMAV",
            "sha256": digest,
            "byte_size": len(content),
        }

    return router
