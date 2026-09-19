"""Signed KRAVIA client for the Supabase Storage broker Edge Function."""

from __future__ import annotations

import base64
import json
import os
import time
from typing import Any

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from supabase import create_client


def _supabase_url() -> str:
    return (os.getenv("SUPABASE_URL", "").strip() or os.getenv("SUPABASE_AUTH_URL", "").strip()).rstrip("/")


def _publishable_key() -> str:
    return os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()


def _private_key_b64() -> str:
    return os.getenv("KRAVIA_STORAGE_BROKER_PRIVATE_KEY", "").strip()


def _broker_url() -> str:
    explicit = os.getenv("KRAVIA_STORAGE_BROKER_URL", "").strip()
    if explicit:
        return explicit
    base = _supabase_url()
    return f"{base}/functions/v1/kravia-storage-broker" if base else ""


def configured() -> bool:
    return bool(_supabase_url() and _publishable_key() and _private_key_b64() and _broker_url())


def _signature(timestamp: str, body: str) -> str:
    try:
        key = serialization.load_der_private_key(base64.b64decode(_private_key_b64()), password=None)
    except Exception as exc:
        raise RuntimeError("KRAVIA_STORAGE_BROKER_KEY_INVALID") from exc
    if not isinstance(key, ec.EllipticCurvePrivateKey):
        raise RuntimeError("KRAVIA_STORAGE_BROKER_KEY_INVALID")
    der = key.sign(f"{timestamp}.{body}".encode(), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der)
    raw = r.to_bytes(32, "big") + s.to_bytes(32, "big")
    return base64.b64encode(raw).decode()


def request(action: str, **payload: Any) -> dict[str, Any]:
    url = _broker_url()
    if not url:
        raise RuntimeError("KRAVIA_STORAGE_BROKER_URL_MISSING")
    body = json.dumps({"action": action, **payload}, sort_keys=True, separators=(",", ":"))
    ts = str(int(time.time()))
    response = httpx.post(
        url,
        content=body,
        headers={
            "content-type": "application/json",
            "x-kravia-timestamp": ts,
            "x-kravia-signature": _signature(ts, body),
        },
        timeout=float(os.getenv("KRAVIA_STORAGE_BROKER_TIMEOUT_SECONDS", "20")),
        follow_redirects=False,
    )
    try:
        data = response.json()
    except Exception:
        data = {}
    if response.status_code >= 300:
        raise RuntimeError(f"STORAGE_BROKER_{data.get('code') if isinstance(data, dict) else response.status_code}")
    if not isinstance(data, dict):
        raise RuntimeError("STORAGE_BROKER_INVALID_RESPONSE")
    return data


def ping() -> bool:
    return request("ping").get("ok") is True


def _upload_client():
    if not _supabase_url() or not _publishable_key():
        raise RuntimeError("SUPABASE_PUBLISHABLE_STORAGE_CLIENT_MISSING")
    return create_client(_supabase_url(), _publishable_key())


def upload_private(bucket: str, path: str, data: bytes, mime: str) -> None:
    ticket = request("signed_upload", bucket=bucket, path=path, upsert=False)
    token = str(ticket.get("token") or "")
    if not token:
        raise RuntimeError("STORAGE_BROKER_UPLOAD_TOKEN_MISSING")
    _upload_client().storage.from_(bucket).upload_to_signed_url(
        path=path,
        token=token,
        file=data,
        file_options={"content-type": mime, "cache-control": "0"},
    )


def signed_download_url(bucket: str, path: str, expires_in: int = 60) -> str:
    ticket = request(
        "signed_download",
        bucket=bucket,
        path=path,
        expires_in=max(15, min(int(expires_in), 300)),
    )
    url = str(ticket.get("url") or "")
    if not url:
        raise RuntimeError("STORAGE_BROKER_DOWNLOAD_URL_MISSING")
    return url


def download_private(bucket: str, path: str, expires_in: int = 120) -> bytes:
    url = signed_download_url(bucket, path, expires_in)
    response = httpx.get(
        url,
        timeout=float(os.getenv("KRAVIA_STORAGE_DOWNLOAD_TIMEOUT_SECONDS", "45")),
        follow_redirects=False,
    )
    response.raise_for_status()
    return response.content


def delete_private(bucket: str, path: str) -> bool:
    try:
        return request("delete", bucket=bucket, path=path).get("deleted") is True
    except Exception:
        return False
