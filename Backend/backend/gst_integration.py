"""Real GST / e-Invoice integration for KRAVIA Office.

The connector implements the standard GST e-invoice security handshake used by
IRIS IRP core APIs:
- RSA/PKCS1 encryption for authentication credentials/app-key envelope
- 32-byte application key
- six-hour auth-token lifecycle
- AES-256/ECB/PKCS7 payload encryption using the returned session key (SEK)

Provider credentials and the IRP public key are secret deployment configuration.
No provider token, password, client secret, app-key, or SEK is persisted.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote, urlparse

import httpx
from cryptography import x509
from cryptography.hazmat.primitives import padding as sym_padding, serialization
from cryptography.hazmat.primitives.asymmetric import padding as asym_padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    Customer,
    GstEinvoiceRecord,
    GstProviderOperation,
    GstTaxpayerSnapshot,
    Invoice,
    LegalEntity,
)
from .services import ENTITY_ID, audit, emit_event, now_utc, uid


IRIS_AUTH_PATH = "/eivital/v1.04/auth"
IRIS_GSTIN_PATH = "/eivital/v1.04/Master/gstin/{gstin}"
IRIS_SYNC_GSTIN_PATH = "/eivital/v1.04/Master/syncgstin/{gstin}"
IRIS_GENERATE_IRN_PATH = "/eicore/v1.03/Invoice"
IRIS_CANCEL_IRN_PATH = "/eicore/v1.03/Invoice/Cancel"
IRIS_GET_IRN_PATH = "/eicore/v1.03/Invoice/irn/{irn}"
IRIS_GET_IRN_BY_DOC_PATH = "/eicore/v1.03/Invoice/irnbydocdetails"
IRIS_HEALTH_PATH = "/eivital/v1.04/heartbeat/ping"

OFFICIAL_DOCS = {
    "core": "https://einvoice6.gst.gov.in/content/core-apis-wiki/",
    "credentials": "https://einvoice6.gst.gov.in/content/kb/api-credentials/",
    "public_keys": "https://einvoice6.gst.gov.in/content/public-keys/",
}


class GstProviderError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        http_status: int | None = None,
        error_code: str | None = None,
        response_hash: str | None = None,
    ):
        super().__init__(message)
        self.http_status = http_status
        self.error_code = error_code
        self.response_hash = response_hash


@dataclass(frozen=True)
class IrisConfig:
    environment: str
    base_url: str
    client_id: str = field(repr=False)
    client_secret: str = field(repr=False)
    username: str = field(repr=False)
    password: str = field(repr=False)
    gstin: str
    public_key_file: str = field(repr=False)
    public_key_b64: str = field(repr=False)
    timeout_seconds: float
    einvoice_enabled: bool
    seller_address1: str
    seller_location: str
    seller_pin: str
    seller_trade_name: str

    @classmethod
    def from_env(cls) -> "IrisConfig":
        environment = os.getenv("GST_IRP_ENVIRONMENT", "sandbox").strip().lower()
        if environment not in {"sandbox", "production"}:
            environment = "sandbox"
        return cls(
            environment=environment,
            base_url=os.getenv("GST_IRP_BASE_URL", "").strip().rstrip("/"),
            client_id=os.getenv("GST_IRP_CLIENT_ID", "").strip(),
            client_secret=os.getenv("GST_IRP_CLIENT_SECRET", "").strip(),
            username=os.getenv("GST_IRP_USERNAME", "").strip(),
            password=os.getenv("GST_IRP_PASSWORD", "").strip(),
            gstin=os.getenv("KRAVIA_GSTIN", "").strip().upper(),
            public_key_file=os.getenv("GST_IRP_PUBLIC_KEY_FILE", "").strip(),
            public_key_b64=os.getenv("GST_IRP_PUBLIC_KEY_PEM_B64", "").strip(),
            timeout_seconds=float(os.getenv("GST_IRP_TIMEOUT_SECONDS", "12")),
            einvoice_enabled=os.getenv("GST_EINVOICE_ENABLED", "false").strip().lower() == "true",
            seller_address1=os.getenv("GST_IRP_SELLER_ADDRESS1", "").strip(),
            seller_location=os.getenv("GST_IRP_SELLER_LOCATION", "").strip(),
            seller_pin=os.getenv("GST_IRP_SELLER_PIN", "").strip(),
            seller_trade_name=os.getenv("GST_IRP_SELLER_TRADE_NAME", "").strip(),
        )

    def missing_core(self) -> list[str]:
        fields = {
            "GST_IRP_BASE_URL": self.base_url,
            "GST_IRP_CLIENT_ID": self.client_id,
            "GST_IRP_CLIENT_SECRET": self.client_secret,
            "GST_IRP_USERNAME": self.username,
            "GST_IRP_PASSWORD": self.password,
            "KRAVIA_GSTIN": self.gstin,
        }
        missing = [name for name, value in fields.items() if not value]
        if not self.public_key_file and not self.public_key_b64:
            missing.append("GST_IRP_PUBLIC_KEY_FILE or GST_IRP_PUBLIC_KEY_PEM_B64")
        return missing

    def missing_invoice_identity(self) -> list[str]:
        fields = {
            "GST_IRP_SELLER_ADDRESS1": self.seller_address1,
            "GST_IRP_SELLER_LOCATION": self.seller_location,
            "GST_IRP_SELLER_PIN": self.seller_pin,
        }
        return [name for name, value in fields.items() if not value]

    def validate_base_url(self) -> None:
        if not self.base_url:
            raise GstProviderError("IRIS IRP base URL is not configured")
        parsed = urlparse(self.base_url)
        local = parsed.hostname in {"localhost", "127.0.0.1"}
        if parsed.scheme != "https" and not (local and os.getenv("APP_ENV", "development") != "production"):
            raise GstProviderError("IRIS IRP base URL must use HTTPS")
        if not parsed.hostname:
            raise GstProviderError("IRIS IRP base URL is invalid")


@dataclass
class IrisSession:
    auth_token: str
    sek: bytes
    expires_at: datetime


_TOKEN_CACHE: dict[str, IrisSession] = {}
_TOKEN_LOCK = threading.Lock()


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode("utf-8")


def _sha256(value: Any) -> str:
    payload = value if isinstance(value, bytes) else _json_bytes(value)
    return hashlib.sha256(payload).hexdigest()


def _aes_encrypt(key: bytes, plaintext: bytes) -> bytes:
    padder = sym_padding.PKCS7(128).padder()
    padded = padder.update(plaintext) + padder.finalize()
    encryptor = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
    return encryptor.update(padded) + encryptor.finalize()


def _aes_decrypt(key: bytes, ciphertext: bytes) -> bytes:
    decryptor = Cipher(algorithms.AES(key), modes.ECB()).decryptor()
    padded = decryptor.update(ciphertext) + decryptor.finalize()
    unpadder = sym_padding.PKCS7(128).unpadder()
    return unpadder.update(padded) + unpadder.finalize()


def _load_public_key(config: IrisConfig):
    if config.public_key_file:
        pem = Path(config.public_key_file).read_bytes()
    elif config.public_key_b64:
        try:
            pem = base64.b64decode(config.public_key_b64)
        except Exception as exc:
            raise GstProviderError("IRIS public key configuration is not valid base64") from exc
    else:
        raise GstProviderError("IRIS public key is not configured")
    try:
        return serialization.load_pem_public_key(pem)
    except ValueError:
        try:
            return x509.load_pem_x509_certificate(pem).public_key()
        except ValueError as exc:
            raise GstProviderError("IRIS public key/certificate is not valid PEM") from exc


def _decode_json_or_b64_json(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        raise GstProviderError("IRIS response data has an unsupported format")
    for candidate in (value.encode("utf-8"),):
        try:
            decoded = base64.b64decode(candidate, validate=True)
            return json.loads(decoded.decode("utf-8"))
        except Exception:
            pass
    try:
        return json.loads(value)
    except Exception as exc:
        raise GstProviderError("IRIS response data is not valid JSON") from exc


def _normalize_session_key(app_key: bytes, encrypted_sek: str) -> bytes:
    try:
        decrypted = _aes_decrypt(app_key, base64.b64decode(encrypted_sek))
    except Exception as exc:
        raise GstProviderError("Unable to decrypt IRIS session key") from exc
    if len(decrypted) in {16, 24, 32}:
        return decrypted
    try:
        decoded = base64.b64decode(decrypted, validate=True)
        if len(decoded) in {16, 24, 32}:
            return decoded
    except Exception:
        pass
    raise GstProviderError("IRIS session key has an invalid length")


def _encode_core_payload(sek: bytes, payload: dict[str, Any]) -> str:
    # Standard IRP contract: Encrypt(Base64(Request JSON), SEK), then transport
    # the ciphertext as base64 text in Data.
    base64_plain = base64.b64encode(_json_bytes(payload))
    return base64.b64encode(_aes_encrypt(sek, base64_plain)).decode("ascii")


def _decode_core_payload(sek: bytes, data: Any) -> dict[str, Any]:
    if isinstance(data, dict):
        return data
    if not isinstance(data, str):
        raise GstProviderError("IRIS encrypted response data is missing")
    try:
        decrypted = _aes_decrypt(sek, base64.b64decode(data))
    except Exception as exc:
        raise GstProviderError("Unable to decrypt IRIS response payload") from exc
    candidates = [decrypted]
    try:
        candidates.append(base64.b64decode(decrypted, validate=True))
    except Exception:
        pass
    for candidate in candidates:
        try:
            return json.loads(candidate.decode("utf-8"))
        except Exception:
            continue
    raise GstProviderError("IRIS decrypted response is not valid JSON")


def _response_status(body: dict[str, Any]) -> str:
    return str(body.get("Status", body.get("status", ""))).strip()


def _provider_error(body: dict[str, Any], http_status: int, response_hash: str) -> GstProviderError:
    details = body.get("ErrorDetails") or body.get("error") or body.get("errors")
    if isinstance(details, str):
        try:
            details = json.loads(base64.b64decode(details).decode("utf-8"))
        except Exception:
            pass
    first: Any = details
    if isinstance(details, list) and details:
        first = details[0]
    code = None
    message = "IRIS IRP rejected the request"
    if isinstance(first, dict):
        code = str(first.get("ErrorCode") or first.get("errorCode") or first.get("code") or "") or None
        message = str(first.get("ErrorDesc") or first.get("message") or first.get("error") or message)
    elif first:
        message = str(first)
    return GstProviderError(message, http_status=http_status, error_code=code, response_hash=response_hash)


def _parse_expiry(value: Any, default_minutes: int) -> datetime:
    if value:
        raw = str(value).strip()
        for fmt in ("%Y-%m-%d %H:%M:%S", "%d-%m-%Y %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
            try:
                parsed = datetime.strptime(raw[:19], fmt).replace(tzinfo=timezone.utc)
                if parsed > now_utc():
                    return parsed
            except ValueError:
                continue
    return now_utc() + timedelta(minutes=default_minutes)


class IrisIRPClient:
    def __init__(self, config: IrisConfig, *, transport: httpx.BaseTransport | None = None):
        self.config = config
        self.config.validate_base_url()
        self._client = httpx.Client(
            timeout=config.timeout_seconds,
            follow_redirects=False,
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def _url(self, path: str) -> str:
        return self.config.base_url + path

    def _cache_key(self) -> str:
        return _sha256({
            "base": self.config.base_url,
            "client": self.config.client_id,
            "user": self.config.username,
            "gstin": self.config.gstin,
        })

    def _auth_headers(self) -> dict[str, str]:
        return {
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "gstin": self.config.gstin,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _core_headers(self, session: IrisSession) -> dict[str, str]:
        return {
            **self._auth_headers(),
            "user_name": self.config.username,
            "authtoken": session.auth_token,
        }

    def authenticate(self, *, force_refresh: bool = False) -> IrisSession:
        missing = self.config.missing_core()
        if missing:
            raise GstProviderError("IRIS IRP core credentials are incomplete: " + ", ".join(missing))
        key = self._cache_key()
        if not force_refresh:
            with _TOKEN_LOCK:
                cached = _TOKEN_CACHE.get(key)
                if cached and cached.expires_at > now_utc() + timedelta(seconds=90):
                    return cached

        app_key = secrets.token_bytes(32)
        auth_payload = {
            "UserName": self.config.username,
            "Password": self.config.password,
            "AppKey": base64.b64encode(app_key).decode("ascii"),
            "ForceRefreshAccessToken": bool(force_refresh),
        }
        encoded = base64.b64encode(_json_bytes(auth_payload))
        encrypted = _load_public_key(self.config).encrypt(encoded, asym_padding.PKCS1v15())
        response = self._client.post(
            self._url(IRIS_AUTH_PATH),
            headers=self._auth_headers(),
            json={"Data": base64.b64encode(encrypted).decode("ascii")},
        )
        body_bytes = response.content
        response_hash = _sha256(body_bytes)
        try:
            body = response.json()
        except Exception as exc:
            raise GstProviderError(
                "IRIS authentication returned non-JSON data",
                http_status=response.status_code,
                response_hash=response_hash,
            ) from exc
        if response.status_code >= 400 or _response_status(body) not in {"1", "True", "true"}:
            raise _provider_error(body, response.status_code, response_hash)

        auth_data = _decode_json_or_b64_json(body.get("Data") or body.get("data"))
        token = str(auth_data.get("AuthToken") or auth_data.get("authToken") or "").strip()
        encrypted_sek = str(auth_data.get("Sek") or auth_data.get("sek") or "").strip()
        if not token or not encrypted_sek:
            raise GstProviderError(
                "IRIS authentication response is missing AuthToken or Sek",
                http_status=response.status_code,
                response_hash=response_hash,
            )
        sek = _normalize_session_key(app_key, encrypted_sek)
        default_minutes = 55 if self.config.environment == "sandbox" else 350
        session = IrisSession(
            auth_token=token,
            sek=sek,
            expires_at=_parse_expiry(auth_data.get("TokenExpiry"), default_minutes),
        )
        with _TOKEN_LOCK:
            _TOKEN_CACHE[key] = session
        return session

    def _decode_response(self, response: httpx.Response, session: IrisSession) -> tuple[dict[str, Any], str]:
        response_hash = _sha256(response.content)
        try:
            body = response.json()
        except Exception as exc:
            raise GstProviderError(
                "IRIS returned non-JSON data",
                http_status=response.status_code,
                response_hash=response_hash,
            ) from exc
        if response.status_code >= 400 or _response_status(body) not in {"1", "True", "true"}:
            raise _provider_error(body, response.status_code, response_hash)
        data = body.get("Data", body.get("data"))
        if data in (None, ""):
            return {}, response_hash
        try:
            return _decode_core_payload(session.sek, data), response_hash
        except GstProviderError:
            # Some IRIS vital endpoints return decoded objects or base64 JSON.
            return _decode_json_or_b64_json(data), response_hash

    def post_core(self, path: str, payload: dict[str, Any]) -> tuple[dict[str, Any], str]:
        session = self.authenticate()
        response = self._client.post(
            self._url(path),
            headers=self._core_headers(session),
            json={"Data": _encode_core_payload(session.sek, payload)},
        )
        return self._decode_response(response, session)

    def get_core(self, path: str, *, params: dict[str, Any] | None = None) -> tuple[dict[str, Any], str]:
        session = self.authenticate()
        response = self._client.get(
            self._url(path),
            headers=self._core_headers(session),
            params=params,
        )
        return self._decode_response(response, session)

    def post_vital(self, path: str) -> tuple[dict[str, Any], str]:
        session = self.authenticate()
        response = self._client.post(self._url(path), headers=self._core_headers(session))
        return self._decode_response(response, session)

    def health(self) -> tuple[dict[str, Any], str]:
        return self.get_core(IRIS_HEALTH_PATH)

    def get_gstin_details(self, gstin: str, *, sync_common_portal: bool = False) -> tuple[dict[str, Any], str]:
        path = (IRIS_SYNC_GSTIN_PATH if sync_common_portal else IRIS_GSTIN_PATH).format(gstin=quote(gstin, safe=""))
        return self.post_vital(path)

    def generate_irn(self, payload: dict[str, Any]) -> tuple[dict[str, Any], str]:
        return self.post_core(IRIS_GENERATE_IRN_PATH, payload)

    def cancel_irn(self, irn: str, reason_code: str, remarks: str) -> tuple[dict[str, Any], str]:
        return self.post_core(IRIS_CANCEL_IRN_PATH, {"Irn": irn, "CnlRsn": reason_code, "CnlRem": remarks})

    def get_irn(self, irn: str) -> tuple[dict[str, Any], str]:
        return self.get_core(IRIS_GET_IRN_PATH.format(irn=quote(irn, safe="")))

    def get_irn_by_document(self, doc_type: str, doc_no: str, doc_date: str) -> tuple[dict[str, Any], str]:
        return self.get_core(
            IRIS_GET_IRN_BY_DOC_PATH,
            params={"doctype": doc_type, "docnum": doc_no, "docdate": doc_date},
        )


class GstinVerifyRequest(BaseModel):
    gstin: str | None = Field(default=None, pattern=r"^[0-9A-Z]{15}$")
    sync_common_portal: bool = False


class CancelIrnRequest(BaseModel):
    reason_code: str = Field(pattern=r"^[1-4]$")
    remarks: str = Field(min_length=3, max_length=100)


def _money(paise_value: int) -> Decimal:
    return (Decimal(paise_value) / Decimal(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _number(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def build_inv01_payload(invoice: Invoice, customer: Customer, entity: LegalEntity, config: IrisConfig) -> dict[str, Any]:
    missing = config.missing_invoice_identity()
    if missing:
        raise GstProviderError("Supplier e-invoice address is incomplete: " + ", ".join(missing))
    if not customer.gstin:
        raise GstProviderError("Customer GSTIN is required for B2B e-invoice generation")
    if customer.country.strip().lower() != "india":
        raise GstProviderError("Direct IRP generation currently supports domestic B2B invoices only")
    if not customer.billing_address or not customer.billing_locality or not customer.billing_pincode:
        raise GstProviderError("Customer billing address, locality and pincode are required for IRN generation")
    if not invoice.sac or len(invoice.sac) != 6:
        raise GstProviderError("A six-digit SAC is required for IRN generation")
    if len(invoice.invoice_no) > 16:
        raise GstProviderError("IRP document number cannot exceed 16 characters")
    if not config.seller_pin.isdigit() or len(config.seller_pin) != 6:
        raise GstProviderError("Supplier e-invoice pincode must contain six digits")
    if not customer.billing_pincode.isdigit() or len(customer.billing_pincode) != 6:
        raise GstProviderError("Customer billing pincode must contain six digits")

    qty = Decimal(invoice.qty_milli) / Decimal(1000)
    taxable = _money(invoice.taxable_paise)
    discount = _money(invoice.discount_paise)
    assessed = _money(invoice.net_taxable_paise)
    cgst = _money(invoice.cgst_paise)
    sgst = _money(invoice.sgst_paise)
    igst = _money(invoice.igst_paise)
    total = _money(invoice.total_paise)
    unit_price = (taxable / qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    gst_rate = (Decimal(invoice.gst_rate_bps) / Decimal(100)).quantize(Decimal("0.01"))
    doc_date = invoice.issued_at.astimezone(timezone.utc).strftime("%d/%m/%Y")

    return {
        "Version": "1.1",
        "TranDtls": {"TaxSch": "GST", "SupTyp": "B2B", "RegRev": "N", "IgstOnIntra": "N"},
        "DocDtls": {"Typ": "INV", "No": invoice.invoice_no, "Dt": doc_date},
        "SellerDtls": {
            "Gstin": config.gstin,
            "LglNm": entity.legal_name,
            **({"TrdNm": config.seller_trade_name} if config.seller_trade_name else {}),
            "Addr1": config.seller_address1[:100],
            "Loc": config.seller_location[:50],
            "Pin": int(config.seller_pin),
            "Stcd": str(entity.state_code or config.gstin[:2]),
        },
        "BuyerDtls": {
            "Gstin": customer.gstin,
            "LglNm": customer.legal_name,
            "Pos": customer.state_code,
            "Addr1": customer.billing_address[:100],
            "Loc": customer.billing_locality[:50],
            "Pin": int(customer.billing_pincode),
            "Stcd": customer.state_code,
        },
        "ItemList": [{
            "SlNo": "1",
            "PrdDesc": invoice.description[:300],
            "IsServc": "Y",
            "HsnCd": invoice.sac,
            "Qty": float(qty),
            "Unit": "OTH",
            "UnitPrice": _number(unit_price),
            "TotAmt": _number(taxable),
            "Discount": _number(discount),
            "AssAmt": _number(assessed),
            "GstRt": _number(gst_rate),
            "IgstAmt": _number(igst),
            "CgstAmt": _number(cgst),
            "SgstAmt": _number(sgst),
            "TotItemVal": _number(total),
        }],
        "ValDtls": {
            "AssVal": _number(assessed),
            "CgstVal": _number(cgst),
            "SgstVal": _number(sgst),
            "IgstVal": _number(igst),
            "CesVal": 0.0,
            "StCesVal": 0.0,
            "Discount": _number(discount),
            "OthChrg": 0.0,
            "RndOffAmt": 0.0,
            "TotInvVal": _number(total),
        },
    }


def _record_operation(
    db: Session,
    config: IrisConfig,
    *,
    operation: str,
    actor: str,
    status: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    request_hash: str | None = None,
    response_hash: str | None = None,
    http_status: int | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
) -> GstProviderOperation:
    row = GstProviderOperation(
        id=uid("GSTOP"),
        provider="IRIS_IRP",
        provider_environment=config.environment,
        operation=operation,
        entity_type=entity_type,
        entity_id=entity_id,
        status=status,
        request_hash=request_hash,
        response_hash=response_hash,
        http_status=http_status,
        error_code=error_code,
        error_message=error_message,
        actor=actor,
    )
    db.add(row)
    return row


def _safe_provider_failure(exc: GstProviderError) -> str:
    return str(exc)[:500]


def _einvoice_json(row: GstEinvoiceRecord) -> dict[str, Any]:
    return {
        "id": row.id,
        "invoice_id": row.invoice_id,
        "provider": row.provider,
        "environment": row.provider_environment,
        "status": row.status,
        "irn": row.irn,
        "ack_no": row.ack_no,
        "ack_at": row.ack_at,
        "generated_at": row.generated_at.isoformat() if row.generated_at else None,
        "cancelled_at": row.cancelled_at.isoformat() if row.cancelled_at else None,
        "cancel_reason_code": row.cancel_reason_code,
        "cancel_remarks": row.cancel_remarks,
        "last_error": row.last_error,
    }


def build_gst_integration_router(
    get_db: Callable,
    actor_context: Callable,
    require_roles: Callable,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/tax/gst", tags=["GST Integration"])

    @router.get("/connector/status")
    def connector_status(db: Session = Depends(get_db), ctx=Depends(actor_context)):
        config = IrisConfig.from_env()
        latest_snapshot = db.execute(
            select(GstTaxpayerSnapshot).order_by(GstTaxpayerSnapshot.verified_at.desc()).limit(1)
        ).scalar_one_or_none()
        latest_operation = db.execute(
            select(GstProviderOperation).order_by(GstProviderOperation.created_at.desc()).limit(1)
        ).scalar_one_or_none()
        missing_core = config.missing_core()
        missing_invoice = config.missing_invoice_identity()
        host = urlparse(config.base_url).hostname if config.base_url else None
        return {
            "provider": "IRIS_IRP",
            "environment": config.environment,
            "base_host": host,
            "core_configured": not missing_core,
            "einvoice_enabled": config.einvoice_enabled,
            "invoice_identity_configured": not missing_invoice,
            "ready_for_live_irn": bool(config.einvoice_enabled and not missing_core and not missing_invoice),
            "missing_configuration": missing_core + missing_invoice,
            "gstin_masked": (config.gstin[:2] + "*" * 10 + config.gstin[-3:]) if len(config.gstin) == 15 else None,
            "last_gstin_verification": {
                "gstin": latest_snapshot.gstin,
                "legal_name": latest_snapshot.legal_name,
                "trade_name": latest_snapshot.trade_name,
                "registration_status": latest_snapshot.registration_status,
                "verified_at": latest_snapshot.verified_at.isoformat(),
            } if latest_snapshot else None,
            "last_operation": {
                "operation": latest_operation.operation,
                "status": latest_operation.status,
                "created_at": latest_operation.created_at.isoformat() if latest_operation.created_at else None,
                "error_code": latest_operation.error_code,
            } if latest_operation else None,
            "official_docs": OFFICIAL_DOCS,
            "secret_storage": "deployment environment only; provider tokens/SEK are memory-only",
        }

    @router.post("/connector/health")
    def connector_health(db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        config = IrisConfig.from_env()
        client = IrisIRPClient(config)
        try:
            result, response_hash = client.health()
            _record_operation(db, config, operation="HEALTH", actor=ctx["actor"], status="SUCCEEDED", response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.irp.health", "integration", "IRIS_IRP", {"environment": config.environment, "status": "SUCCEEDED"}, "CONTROL")
            db.commit()
            return {"status": "SUCCEEDED", "provider": "IRIS_IRP", "environment": config.environment, "result": result}
        except GstProviderError as exc:
            _record_operation(db, config, operation="HEALTH", actor=ctx["actor"], status="FAILED", http_status=exc.http_status, error_code=exc.error_code, error_message=_safe_provider_failure(exc), response_hash=exc.response_hash)
            db.commit()
            raise HTTPException(status_code=409 if config.missing_core() else 502, detail=_safe_provider_failure(exc))
        finally:
            client.close()

    @router.post("/connector/verify-gstin")
    def verify_gstin(payload: GstinVerifyRequest, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        config = IrisConfig.from_env()
        target = (payload.gstin or config.gstin).upper().strip()
        if len(target) != 15:
            raise HTTPException(422, "A 15-character GSTIN is required")
        client = IrisIRPClient(config)
        operation = "SYNC_GSTIN" if payload.sync_common_portal else "GET_GSTIN"
        request_hash = _sha256({"gstin": target, "sync": payload.sync_common_portal})
        try:
            result, response_hash = client.get_gstin_details(target, sync_common_portal=payload.sync_common_portal)
            normalized = {str(k).lower(): v for k, v in result.items()}
            snapshot = GstTaxpayerSnapshot(
                id=uid("GSTIN"),
                provider="IRIS_IRP",
                gstin=target,
                legal_name=normalized.get("legalname") or normalized.get("lglname") or normalized.get("lgl_nm"),
                trade_name=normalized.get("tradename") or normalized.get("trdnm"),
                taxpayer_type=normalized.get("txptype") or normalized.get("taxpayertype"),
                registration_status=normalized.get("status") or normalized.get("sts"),
                state_code=str(normalized.get("statecode") or normalized.get("stcd") or target[:2])[:2],
                pincode=str(normalized.get("pincode") or normalized.get("pin") or "")[:6] or None,
                source_response_hash=response_hash,
                raw_json=json.dumps(result, sort_keys=True, default=str),
                verified_at=now_utc(),
            )
            db.add(snapshot)
            _record_operation(db, config, operation=operation, actor=ctx["actor"], status="SUCCEEDED", entity_type="gstin", entity_id=target, request_hash=request_hash, response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.gstin.verified", "gstin", target, {"provider": "IRIS_IRP", "sync_common_portal": payload.sync_common_portal, "registration_status": snapshot.registration_status, "response_hash": response_hash}, "CONTROL")
            db.commit()
            return {
                "gstin": snapshot.gstin,
                "legal_name": snapshot.legal_name,
                "trade_name": snapshot.trade_name,
                "taxpayer_type": snapshot.taxpayer_type,
                "registration_status": snapshot.registration_status,
                "state_code": snapshot.state_code,
                "pincode": snapshot.pincode,
                "verified_at": snapshot.verified_at.isoformat(),
                "provider": snapshot.provider,
                "source_response_hash": response_hash,
            }
        except GstProviderError as exc:
            _record_operation(db, config, operation=operation, actor=ctx["actor"], status="FAILED", entity_type="gstin", entity_id=target, request_hash=request_hash, response_hash=exc.response_hash, http_status=exc.http_status, error_code=exc.error_code, error_message=_safe_provider_failure(exc))
            db.commit()
            raise HTTPException(status_code=409 if config.missing_core() else 502, detail=_safe_provider_failure(exc))
        finally:
            client.close()

    @router.get("/einvoice")
    def list_einvoices(db: Session = Depends(get_db), ctx=Depends(actor_context), limit: int = 100):
        limit = max(1, min(limit, 500))
        rows = db.execute(select(GstEinvoiceRecord).order_by(GstEinvoiceRecord.created_at.desc()).limit(limit)).scalars().all()
        return [_einvoice_json(row) for row in rows]

    @router.get("/einvoice/{invoice_id}")
    def get_einvoice(invoice_id: str, db: Session = Depends(get_db), ctx=Depends(actor_context)):
        row = db.execute(select(GstEinvoiceRecord).where(GstEinvoiceRecord.invoice_id == invoice_id)).scalar_one_or_none()
        if not row:
            raise HTTPException(404, "E-invoice record not found")
        return _einvoice_json(row)

    @router.post("/einvoice/{invoice_id}/generate")
    def generate_irn(invoice_id: str, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        config = IrisConfig.from_env()
        if not config.einvoice_enabled:
            raise HTTPException(409, "GST e-invoice generation is disabled until eligibility and provider access are approved")
        if config.missing_core():
            raise HTTPException(409, "IRIS IRP core credentials are not configured")
        invoice = db.get(Invoice, invoice_id)
        if not invoice:
            raise HTTPException(404, "Invoice not found")
        existing = db.execute(select(GstEinvoiceRecord).where(GstEinvoiceRecord.invoice_id == invoice_id)).scalar_one_or_none()
        if existing and existing.status == "GENERATED" and existing.irn:
            return _einvoice_json(existing)
        if existing and existing.status == "CANCELLED":
            raise HTTPException(409, "Cancelled IRN cannot be regenerated for the same invoice document")
        customer = db.get(Customer, invoice.customer_id)
        entity = db.get(LegalEntity, ENTITY_ID)
        if not customer or not entity:
            raise HTTPException(409, "Canonical invoice party data is incomplete")
        try:
            inv01 = build_inv01_payload(invoice, customer, entity, config)
        except GstProviderError as exc:
            raise HTTPException(422, detail=_safe_provider_failure(exc))
        request_hash = _sha256(inv01)
        client = IrisIRPClient(config)
        try:
            result, response_hash = client.generate_irn(inv01)
            irn = str(result.get("Irn") or result.get("irn") or "").strip()
            ack_no = str(result.get("AckNo") or result.get("ackNo") or "").strip() or None
            ack_at = str(result.get("AckDt") or result.get("ackDt") or "").strip() or None
            if not irn:
                raise GstProviderError("IRIS generate-IRN response did not include an IRN", response_hash=response_hash)
            row = existing or GstEinvoiceRecord(
                id=uid("EINV"),
                invoice_id=invoice.id,
                provider="IRIS_IRP",
                provider_environment=config.environment,
                request_hash=request_hash,
            )
            row.status = "GENERATED"
            row.irn = irn
            row.ack_no = ack_no
            row.ack_at = ack_at
            row.signed_invoice = result.get("SignedInvoice") or result.get("signedInvoice")
            row.signed_qr_code = result.get("SignedQRCode") or result.get("signedQRCode")
            row.request_hash = request_hash
            row.response_hash = response_hash
            row.generated_at = now_utc()
            row.last_error = None
            if not existing:
                db.add(row)
            _record_operation(db, config, operation="GENERATE_IRN", actor=ctx["actor"], status="SUCCEEDED", entity_type="invoice", entity_id=invoice.id, request_hash=request_hash, response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.irn.generated", "invoice", invoice.id, {"provider": "IRIS_IRP", "irn": irn, "ack_no": ack_no, "request_hash": request_hash, "response_hash": response_hash}, "FINANCIAL")
            emit_event(db, "gst.irn.generated", "invoice", invoice.id, {"irn": irn, "ack_no": ack_no, "provider": "IRIS_IRP"})
            db.commit()
            return _einvoice_json(row)
        except GstProviderError as exc:
            row = existing or GstEinvoiceRecord(
                id=uid("EINV"),
                invoice_id=invoice.id,
                provider="IRIS_IRP",
                provider_environment=config.environment,
                request_hash=request_hash,
            )
            row.status = "FAILED"
            row.request_hash = request_hash
            row.response_hash = exc.response_hash
            row.last_error = _safe_provider_failure(exc)
            if not existing:
                db.add(row)
            _record_operation(db, config, operation="GENERATE_IRN", actor=ctx["actor"], status="FAILED", entity_type="invoice", entity_id=invoice.id, request_hash=request_hash, response_hash=exc.response_hash, http_status=exc.http_status, error_code=exc.error_code, error_message=_safe_provider_failure(exc))
            audit(db, ctx["actor"], ctx["role"], "gst.irn.failed", "invoice", invoice.id, {"provider": "IRIS_IRP", "error_code": exc.error_code, "response_hash": exc.response_hash}, "FINANCIAL")
            db.commit()
            raise HTTPException(502, detail=_safe_provider_failure(exc))
        finally:
            client.close()

    @router.post("/einvoice/{invoice_id}/cancel")
    def cancel_irn(invoice_id: str, payload: CancelIrnRequest, db: Session = Depends(get_db), ctx=Depends(require_roles("OWNER", "CA"))):
        config = IrisConfig.from_env()
        if not config.einvoice_enabled:
            raise HTTPException(409, "GST e-invoice operations are disabled")
        row = db.execute(select(GstEinvoiceRecord).where(GstEinvoiceRecord.invoice_id == invoice_id)).scalar_one_or_none()
        if not row or not row.irn:
            raise HTTPException(404, "Generated IRN not found")
        if row.status == "CANCELLED":
            return _einvoice_json(row)
        request_payload = {"Irn": row.irn, "CnlRsn": payload.reason_code, "CnlRem": payload.remarks}
        request_hash = _sha256(request_payload)
        client = IrisIRPClient(config)
        try:
            result, response_hash = client.cancel_irn(row.irn, payload.reason_code, payload.remarks)
            row.status = "CANCELLED"
            row.cancel_reason_code = payload.reason_code
            row.cancel_remarks = payload.remarks
            row.cancelled_at = now_utc()
            row.response_hash = response_hash
            row.last_error = None
            _record_operation(db, config, operation="CANCEL_IRN", actor=ctx["actor"], status="SUCCEEDED", entity_type="invoice", entity_id=invoice_id, request_hash=request_hash, response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.irn.cancelled", "invoice", invoice_id, {"irn": row.irn, "reason_code": payload.reason_code, "response_hash": response_hash}, "FINANCIAL")
            emit_event(db, "gst.irn.cancelled", "invoice", invoice_id, {"irn": row.irn, "reason_code": payload.reason_code})
            db.commit()
            return {**_einvoice_json(row), "provider_result": result}
        except GstProviderError as exc:
            row.last_error = _safe_provider_failure(exc)
            _record_operation(db, config, operation="CANCEL_IRN", actor=ctx["actor"], status="FAILED", entity_type="invoice", entity_id=invoice_id, request_hash=request_hash, response_hash=exc.response_hash, http_status=exc.http_status, error_code=exc.error_code, error_message=_safe_provider_failure(exc))
            db.commit()
            raise HTTPException(502, detail=_safe_provider_failure(exc))
        finally:
            client.close()

    return router
