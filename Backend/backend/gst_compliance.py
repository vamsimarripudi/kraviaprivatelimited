"""GST purchase-data, reconciliation and return-working subsystem.

IRIS IRP Data API endpoints are used only when explicit VAS credentials and
taxpayer consent exist. Because IRIS issues the integration contract/Portal ID
per integrator, transport header names are deployment configuration. Provider
request JSON is treated as an opaque, size-limited filter object and secrets are
forbidden from it.

This module never asserts ITC eligibility and never marks a GST return FILED
without external filing evidence/ARN.
"""
from __future__ import annotations

import hashlib
import io
import json
import os
import re
import zipfile
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Callable
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from .models import (
    BankTransaction,
    GstDataDownloadJob,
    GstPurchaseInvoice,
    GstReconciliationRun,
    GstReturnWorking,
    Invoice,
    Vendor,
)
from .services import audit, emit_event, now_utc, uid

IRIS_PURCHASE_DOWNLOAD_PATH = "/portal/download/buyer/view/file"
IRIS_DATA_STATUS_PATH = "/portal/download/view/file/status"

_BLOCKED_PROVIDER_KEYS = re.compile(
    r"(password|passwd|secret|token|otp|portal.?id|client.?id|client.?secret|authorization)",
    re.I,
)


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode()


def _hash(value: Any) -> str:
    if isinstance(value, bytes):
        return hashlib.sha256(value).hexdigest()
    return hashlib.sha256(_json_bytes(value)).hexdigest()


def _paise(value: Any) -> int:
    try:
        amount = Decimal(str(value or "0"))
    except Exception:
        amount = Decimal("0")
    return int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _safe_provider_object(value: Any, *, limit_bytes: int = 16384) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("Provider request must be a JSON object")
    payload = _json_bytes(value)
    if len(payload) > limit_bytes:
        raise ValueError("Provider request exceeds 16 KiB")
    stack = [value]
    while stack:
        current = stack.pop()
        if isinstance(current, dict):
            for key, nested in current.items():
                if _BLOCKED_PROVIDER_KEYS.search(str(key)):
                    raise ValueError(f"Provider request may not contain secret/auth field: {key}")
                stack.append(nested)
        elif isinstance(current, list):
            stack.extend(current)
    return value


class IrisVasConfig:
    def __init__(self):
        self.base_url = os.getenv("GST_IRP_VAS_BASE_URL", "").strip().rstrip("/")
        self.portal_id = os.getenv("GST_IRP_VAS_PORTAL_ID", "").strip()
        self.user_id = os.getenv("GST_IRP_VAS_USER_ID", "").strip()
        self.auth_token = os.getenv("GST_IRP_VAS_AUTH_TOKEN", "").strip()
        self.timeout = float(os.getenv("GST_IRP_VAS_TIMEOUT_SECONDS", "20"))
        self.portal_header = os.getenv("GST_IRP_VAS_PORTAL_ID_HEADER", "portalid").strip()
        self.user_header = os.getenv("GST_IRP_VAS_USER_ID_HEADER", "user_id").strip()
        self.auth_header = os.getenv("GST_IRP_VAS_AUTH_TOKEN_HEADER", "auth-token").strip()
        self.max_download_bytes = int(os.getenv("GST_IRP_VAS_MAX_DOWNLOAD_BYTES", str(25 * 1024 * 1024)))
        base_host = urlparse(self.base_url).hostname if self.base_url else None
        configured_hosts = {
            host.strip().lower()
            for host in os.getenv("GST_IRP_VAS_DOWNLOAD_HOSTS", "").split(",")
            if host.strip()
        }
        self.download_hosts = configured_hosts | ({base_host.lower()} if base_host else set())

    def missing(self) -> list[str]:
        values = {
            "GST_IRP_VAS_BASE_URL": self.base_url,
            "GST_IRP_VAS_PORTAL_ID": self.portal_id,
            "GST_IRP_VAS_USER_ID": self.user_id,
            "GST_IRP_VAS_AUTH_TOKEN": self.auth_token,
        }
        return [key for key, value in values.items() if not value]

    def validate_url(self) -> None:
        parsed = urlparse(self.base_url)
        local = parsed.hostname in {"localhost", "127.0.0.1"}
        if not parsed.hostname:
            raise ValueError("IRIS VAS base URL is invalid")
        if parsed.scheme != "https" and not (local and os.getenv("APP_ENV", "development") != "production"):
            raise ValueError("IRIS VAS base URL must use HTTPS")

    def headers(self) -> dict[str, str]:
        return {
            self.portal_header: self.portal_id,
            self.user_header: self.user_id,
            self.auth_header: self.auth_token,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }


class IrisVasClient:
    def __init__(self, config: IrisVasConfig, *, transport: httpx.BaseTransport | None = None):
        self.config = config
        self.config.validate_url()
        self.client = httpx.Client(timeout=config.timeout, follow_redirects=False, transport=transport)

    def close(self) -> None:
        self.client.close()

    def request_purchase_download(self, provider_payload: dict[str, Any]) -> tuple[dict[str, Any], str]:
        response = self.client.post(
            self.config.base_url + IRIS_PURCHASE_DOWNLOAD_PATH,
            headers=self.config.headers(),
            json=provider_payload,
        )
        return self._decode(response)

    def get_download_status(self, provider_query: dict[str, Any]) -> tuple[dict[str, Any], str]:
        response = self.client.get(
            self.config.base_url + IRIS_DATA_STATUS_PATH,
            headers=self.config.headers(),
            params={str(k): str(v) for k, v in provider_query.items()},
        )
        return self._decode(response)

    def download_result_file(self, url: str) -> bytes:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        if parsed.scheme != "https" or not host:
            raise ValueError("Provider result URL must use HTTPS")
        if host not in self.config.download_hosts:
            raise ValueError("Provider result host is not allowlisted")
        base_host = (urlparse(self.config.base_url).hostname or "").lower()
        headers = {self.config.auth_header: self.config.auth_token} if host == base_host else {}
        response = self.client.get(url, headers=headers)
        response.raise_for_status()
        if len(response.content) > self.config.max_download_bytes:
            raise ValueError("Provider result file exceeds configured limit")
        return response.content

    @staticmethod
    def _decode(response: httpx.Response) -> tuple[dict[str, Any], str]:
        digest = _hash(response.content)
        try:
            body = response.json()
        except Exception as exc:
            raise RuntimeError(f"IRIS VAS returned non-JSON HTTP {response.status_code}") from exc
        if response.status_code >= 400:
            message = body.get("message") or body.get("error") or body.get("detail") or "IRIS VAS request failed"
            raise RuntimeError(f"IRIS VAS HTTP {response.status_code}: {message}")
        return body, digest


def _find_first(obj: Any, names: set[str]) -> Any:
    if isinstance(obj, dict):
        for key, value in obj.items():
            if str(key).lower() in names and value not in (None, ""):
                return value
        for value in obj.values():
            found = _find_first(value, names)
            if found not in (None, ""):
                return found
    elif isinstance(obj, list):
        for value in obj:
            found = _find_first(value, names)
            if found not in (None, ""):
                return found
    return None


def _extract_result_url(obj: Any) -> str | None:
    value = _find_first(obj, {"fileurl", "downloadurl", "url", "file_url", "download_url"})
    if isinstance(value, str) and value.startswith("https://"):
        return value
    return None


def _extract_request_id(obj: Any) -> str | None:
    value = _find_first(obj, {"requestid", "request_id", "referenceid", "reference_id", "id"})
    return str(value)[:160] if value not in (None, "") else None


def _invoice_nodes(value: Any) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    if isinstance(value, dict):
        lowered = {str(k).lower() for k in value.keys()}
        if {"sellerdtls", "buyerdtls", "docdtls"}.issubset(lowered):
            found.append(value)
        else:
            for nested in value.values():
                found.extend(_invoice_nodes(nested))
    elif isinstance(value, list):
        for nested in value:
            found.extend(_invoice_nodes(nested))
    return found


def _ci_get(obj: dict[str, Any], key: str) -> Any:
    for actual, value in obj.items():
        if str(actual).lower() == key.lower():
            return value
    return None


def _normalize_doc_date(value: str) -> str:
    raw = str(value or "").strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw[:10], fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError("Unsupported IRIS document date format")


def _normalize_purchase(node: dict[str, Any]) -> dict[str, Any]:
    seller = _ci_get(node, "SellerDtls") or {}
    doc = _ci_get(node, "DocDtls") or {}
    val = _ci_get(node, "ValDtls") or {}
    buyer = _ci_get(node, "BuyerDtls") or {}
    supplier_gstin = str(_ci_get(seller, "Gstin") or "").upper().strip()
    doc_no = str(_ci_get(doc, "No") or "").strip()
    doc_date_raw = str(_ci_get(doc, "Dt") or "").strip()
    doc_type = str(_ci_get(doc, "Typ") or "INV").upper().strip()
    if not supplier_gstin or not doc_no or not doc_date_raw:
        raise ValueError("IRIS purchase invoice is missing supplier GSTIN/document identity")
    doc_date = _normalize_doc_date(doc_date_raw)
    return {
        "irn": str(_ci_get(node, "Irn") or _ci_get(node, "IRN") or "").strip() or None,
        "supplier_gstin": supplier_gstin,
        "supplier_name": str(_ci_get(seller, "LglNm") or _ci_get(seller, "TrdNm") or "").strip() or None,
        "document_type": doc_type,
        "document_no": doc_no,
        "document_date": doc_date,
        "place_of_supply": str(_ci_get(buyer, "Pos") or "").zfill(2)[:2] or None,
        "taxable_paise": _paise(_ci_get(val, "AssVal")),
        "cgst_paise": _paise(_ci_get(val, "CgstVal")),
        "sgst_paise": _paise(_ci_get(val, "SgstVal")),
        "igst_paise": _paise(_ci_get(val, "IgstVal")),
        "cess_paise": _paise(_ci_get(val, "CesVal")),
        "total_paise": _paise(_ci_get(val, "TotInvVal")),
        "irn_status": str(_ci_get(node, "Status") or _ci_get(node, "IrnStatus") or "").strip() or None,
        "raw": node,
    }


def _import_purchase_payload(db: Session, payload: Any, source_job_id: str | None = None) -> dict[str, int]:
    nodes = _invoice_nodes(payload)
    imported = duplicate = invalid = 0
    for node in nodes:
        try:
            normalized = _normalize_purchase(node)
        except ValueError:
            invalid += 1
            continue
        source_hash = _hash(node)
        existing = db.execute(
            select(GstPurchaseInvoice).where(GstPurchaseInvoice.source_hash == source_hash)
        ).scalar_one_or_none()
        if existing:
            duplicate += 1
            continue
        vendor = db.execute(
            select(Vendor).where(func.upper(Vendor.gstin) == normalized["supplier_gstin"])
        ).scalar_one_or_none()
        row = GstPurchaseInvoice(
            id=uid("GSTPUR"),
            provider="IRIS_IRP" if source_job_id else "MANUAL_IRIS_JSON",
            source_job_id=source_job_id,
            irn=normalized["irn"],
            supplier_gstin=normalized["supplier_gstin"],
            supplier_name=normalized["supplier_name"],
            document_type=normalized["document_type"],
            document_no=normalized["document_no"],
            document_date=normalized["document_date"],
            place_of_supply=normalized["place_of_supply"],
            taxable_paise=normalized["taxable_paise"],
            cgst_paise=normalized["cgst_paise"],
            sgst_paise=normalized["sgst_paise"],
            igst_paise=normalized["igst_paise"],
            cess_paise=normalized["cess_paise"],
            total_paise=normalized["total_paise"],
            irn_status=normalized["irn_status"],
            source_hash=source_hash,
            raw_json=json.dumps(node, sort_keys=True, default=str),
            vendor_id=vendor.id if vendor else None,
            reconciliation_status="VENDOR_MATCHED" if vendor else "VENDOR_MISSING",
            itc_review_status="REVIEW_REQUIRED",
        )
        db.add(row)
        imported += 1
    return {"imported": imported, "duplicate": duplicate, "invalid": invalid, "seen": len(nodes)}


def _decode_result_bytes(content: bytes) -> list[Any]:
    payloads: list[Any] = []
    if zipfile.is_zipfile(io.BytesIO(content)):
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            total = 0
            for info in archive.infolist():
                if info.is_dir() or not info.filename.lower().endswith(".json"):
                    continue
                if info.file_size > 10 * 1024 * 1024:
                    raise ValueError("JSON entry in provider archive exceeds 10 MiB")
                total += info.file_size
                if total > 25 * 1024 * 1024:
                    raise ValueError("Uncompressed provider archive exceeds 25 MiB")
                payloads.append(json.loads(archive.read(info).decode("utf-8")))
    else:
        payloads.append(json.loads(content.decode("utf-8")))
    return payloads


def _purchase_json(row: GstPurchaseInvoice) -> dict[str, Any]:
    return {
        "id": row.id,
        "provider": row.provider,
        "irn": row.irn,
        "supplier_gstin": row.supplier_gstin,
        "supplier_name": row.supplier_name,
        "document_type": row.document_type,
        "document_no": row.document_no,
        "document_date": row.document_date,
        "place_of_supply": row.place_of_supply,
        "taxable": f"{Decimal(row.taxable_paise)/100:.2f}",
        "cgst": f"{Decimal(row.cgst_paise)/100:.2f}",
        "sgst": f"{Decimal(row.sgst_paise)/100:.2f}",
        "igst": f"{Decimal(row.igst_paise)/100:.2f}",
        "cess": f"{Decimal(row.cess_paise)/100:.2f}",
        "total": f"{Decimal(row.total_paise)/100:.2f}",
        "irn_status": row.irn_status,
        "vendor_id": row.vendor_id,
        "bank_transaction_id": row.bank_transaction_id,
        "reconciliation_status": row.reconciliation_status,
        "itc_review_status": row.itc_review_status,
        "source_hash": row.source_hash,
    }


def _reconcile_row(db: Session, row: GstPurchaseInvoice) -> str:
    vendor = None
    if row.vendor_id:
        vendor = db.get(Vendor, row.vendor_id)
    if not vendor:
        vendor = db.execute(
            select(Vendor).where(func.upper(Vendor.gstin) == row.supplier_gstin)
        ).scalar_one_or_none()
        if vendor:
            row.vendor_id = vendor.id
    if not vendor:
        row.bank_transaction_id = None
        row.reconciliation_status = "VENDOR_MISSING"
        return row.reconciliation_status

    debits = db.execute(
        select(BankTransaction).where(
            BankTransaction.direction == "DEBIT",
            BankTransaction.amount_paise == row.total_paise,
        )
    ).scalars().all()
    exact = [
        tx for tx in debits
        if row.document_no.lower() in ((tx.reference or "") + " " + (tx.description or "")).lower()
    ]
    if len(exact) == 1:
        row.bank_transaction_id = exact[0].id
        row.reconciliation_status = "BANK_MATCHED"
    elif len(debits) == 1:
        row.bank_transaction_id = debits[0].id
        row.reconciliation_status = "BANK_CANDIDATE"
    elif debits:
        row.bank_transaction_id = None
        row.reconciliation_status = "MULTIPLE_BANK_CANDIDATES"
    else:
        row.bank_transaction_id = None
        row.reconciliation_status = "UNMATCHED"
    return row.reconciliation_status


def _return_json(row: GstReturnWorking) -> dict[str, Any]:
    return {
        "id": row.id,
        "form_type": row.form_type,
        "period": row.period,
        "status": row.status,
        "source_hash": row.source_hash,
        "summary": json.loads(row.summary_json or "{}"),
        "prepared_by": row.prepared_by,
        "reviewed_by": row.reviewed_by,
        "reviewed_at": row.reviewed_at.isoformat() if row.reviewed_at else None,
        "filing_provider": row.filing_provider,
        "filing_arn": row.filing_arn,
        "filing_evidence_ref": row.filing_evidence_ref,
        "filed_at": row.filed_at.isoformat() if row.filed_at else None,
    }


def _period_bounds(period: str) -> tuple[str, str]:
    if not re.fullmatch(r"\d{4}-\d{2}", period):
        raise ValueError("Period must be YYYY-MM")
    year, month = [int(x) for x in period.split("-")]
    if month < 1 or month > 12:
        raise ValueError("Invalid month")
    start = f"{year:04d}-{month:02d}-01"
    if month == 12:
        next_y, next_m = year + 1, 1
    else:
        next_y, next_m = year, month + 1
    end_exclusive = f"{next_y:04d}-{next_m:02d}-01"
    return start, end_exclusive


def _build_return_summary(db: Session, form_type: str, period: str) -> dict[str, Any]:
    start, end = _period_bounds(period)
    # Select canonical timestamps in Python so the working calculation behaves
    # identically on SQLite CI and PostgreSQL production.
    all_sales = db.execute(select(Invoice)).scalars().all()
    sales = [row for row in all_sales if row.issued_at and row.issued_at.strftime("%Y-%m") == period]
    purchases = db.execute(
        select(GstPurchaseInvoice).where(
            GstPurchaseInvoice.document_date >= start,
            GstPurchaseInvoice.document_date < end,
        )
    ).scalars().all()
    output = {
        "taxable": sum(row.net_taxable_paise for row in sales),
        "cgst": sum(row.cgst_paise for row in sales),
        "sgst": sum(row.sgst_paise for row in sales),
        "igst": sum(row.igst_paise for row in sales),
        "total": sum(row.total_paise for row in sales),
        "invoice_count": len(sales),
    }
    observed_input = {
        "taxable": sum(row.taxable_paise for row in purchases),
        "cgst": sum(row.cgst_paise for row in purchases),
        "sgst": sum(row.sgst_paise for row in purchases),
        "igst": sum(row.igst_paise for row in purchases),
        "cess": sum(row.cess_paise for row in purchases),
        "invoice_count": len(purchases),
        "review_required": sum(1 for row in purchases if row.itc_review_status == "REVIEW_REQUIRED"),
    }
    if form_type == "GSTR1":
        return {
            "form": "GSTR1",
            "period": period,
            "outward": output,
            "notes": [
                "Working return derived from canonical sales invoices.",
                "E-invoice data may auto-populate GSTR-1 on the GST Portal; this working does not claim filing.",
            ],
        }
    if form_type == "GSTR3B":
        return {
            "form": "GSTR3B",
            "period": period,
            "outward_tax": output,
            "inward_gst_observed": observed_input,
            "itc_claim": None,
            "notes": [
                "Inward GST is observational only and is not treated as eligible ITC.",
                "ITC requires GSTR-2B/legal/professional review before any claim.",
            ],
        }
    raise ValueError("Supported forms are GSTR1 and GSTR3B")


class ProviderObjectRequest(BaseModel):
    provider_payload: dict[str, Any]
    period_from: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    period_to: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    @field_validator("provider_payload")
    @classmethod
    def validate_provider_payload(cls, value):
        return _safe_provider_object(value)


class ProviderStatusRequest(BaseModel):
    job_id: str
    provider_query: dict[str, Any]

    @field_validator("provider_query")
    @classmethod
    def validate_provider_query(cls, value):
        return _safe_provider_object(value, limit_bytes=4096)


class PurchaseImportRequest(BaseModel):
    payload: Any


class ReturnBuildRequest(BaseModel):
    form_type: str = Field(pattern=r"^(GSTR1|GSTR3B)$")
    period: str = Field(pattern=r"^\d{4}-\d{2}$")


class ReturnReviewRequest(BaseModel):
    decision: str = Field(pattern=r"^(APPROVE|REJECT)$")
    note: str = Field(min_length=3, max_length=1000)


class FilingEvidenceRequest(BaseModel):
    provider: str = Field(min_length=2, max_length=80)
    arn: str = Field(min_length=5, max_length=80)
    evidence_ref: str = Field(min_length=3, max_length=2000)


def build_gst_compliance_router(
    get_db: Callable,
    actor_context: Callable,
    require_roles: Callable,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/tax/gst", tags=["GST Compliance"])

    @router.get("/vas/status")
    def vas_status(ctx=Depends(actor_context)):
        config = IrisVasConfig()
        gsp_provider = os.getenv("GST_GSP_PROVIDER", "").strip()
        gsp_base = os.getenv("GST_GSP_BASE_URL", "").strip()
        return {
            "provider": "IRIS_IRP",
            "data_api_configured": not config.missing(),
            "missing_configuration": config.missing(),
            "recipient_download_path": IRIS_PURCHASE_DOWNLOAD_PATH,
            "download_status_path": IRIS_DATA_STATUS_PATH,
            "consent_required": True,
            "auth_model": "Portal ID + taxpayer user authorisation token",
            "gsp": {
                "provider": gsp_provider or None,
                "configured": bool(gsp_provider and gsp_base),
                "filing_enabled": False,
                "note": "Return filing remains disabled until a provider-specific GSTN-empanelled GSP adapter is configured and acceptance-tested.",
            },
        }

    @router.post("/vas/purchases/request", status_code=201)
    def request_purchase_download(payload: ProviderObjectRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        config = IrisVasConfig()
        missing = config.missing()
        if missing:
            raise HTTPException(409, "IRIS VAS/Data API is not configured: " + ", ".join(missing))
        client = IrisVasClient(config)
        request_hash = _hash(payload.provider_payload)
        try:
            response, response_hash = client.request_purchase_download(payload.provider_payload)
            provider_request_id = _extract_request_id(response)
            job = GstDataDownloadJob(
                id=uid("GSTJOB"),
                provider="IRIS_IRP",
                provider_environment=os.getenv("GST_IRP_ENVIRONMENT", "sandbox"),
                direction="PURCHASE",
                status="REQUESTED",
                provider_request_id=provider_request_id,
                period_from=payload.period_from,
                period_to=payload.period_to,
                request_hash=request_hash,
                response_hash=response_hash,
                provider_status_json=json.dumps(response, sort_keys=True, default=str),
                requested_by=ctx["actor"],
            )
            db.add(job)
            audit(db, ctx["actor"], ctx["role"], "gst.purchase_download.requested", "gst_data_download_job", job.id, {"provider_request_id": provider_request_id, "request_hash": request_hash, "response_hash": response_hash}, "CONTROL")
            db.commit()
            return {"id": job.id, "status": job.status, "provider_request_id": job.provider_request_id, "response_hash": response_hash}
        except Exception as exc:
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.post("/vas/purchases/status")
    def purchase_download_status(payload: ProviderStatusRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        config = IrisVasConfig()
        missing = config.missing()
        if missing:
            raise HTTPException(409, "IRIS VAS/Data API is not configured: " + ", ".join(missing))
        job = db.get(GstDataDownloadJob, payload.job_id)
        if not job:
            raise HTTPException(404, "GST data download job not found")
        client = IrisVasClient(config)
        try:
            response, response_hash = client.get_download_status(payload.provider_query)
            job.response_hash = response_hash
            job.provider_status_json = json.dumps(response, sort_keys=True, default=str)
            result_url = _extract_result_url(response)
            imported = {"imported": 0, "duplicate": 0, "invalid": 0, "seen": 0}
            if result_url:
                content = client.download_result_file(result_url)
                job.result_file_hash = _hash(content)
                for provider_payload in _decode_result_bytes(content):
                    batch = _import_purchase_payload(db, provider_payload, source_job_id=job.id)
                    for key in imported:
                        imported[key] += batch[key]
                job.imported_count += imported["imported"]
                job.status = "COMPLETED"
                job.completed_at = now_utc()
            else:
                provider_status = str(_find_first(response, {"status", "requeststatus", "file_status"}) or "").upper()
                job.status = "COMPLETED" if provider_status in {"SUCCESS", "COMPLETED"} else ("FAILED" if provider_status in {"FAILED", "ERROR"} else "IN_PROGRESS")
            audit(db, ctx["actor"], ctx["role"], "gst.purchase_download.status", "gst_data_download_job", job.id, {"status": job.status, "response_hash": response_hash, "imported": imported}, "CONTROL")
            db.commit()
            return {"id": job.id, "status": job.status, "provider_request_id": job.provider_request_id, "response_hash": response_hash, "import": imported}
        except Exception as exc:
            job.status = "FAILED"
            job.last_error = str(exc)[:500]
            db.commit()
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.post("/purchases/import", status_code=201)
    def import_purchase_json(payload: PurchaseImportRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        result = _import_purchase_payload(db, payload.payload)
        audit(db, ctx["actor"], ctx["role"], "gst.purchase_json.imported", "gst_purchase_invoice", "batch", result, "CONTROL")
        db.commit()
        return result

    @router.get("/purchases")
    def list_purchases(db: Session=Depends(get_db), ctx=Depends(actor_context), limit: int=Query(default=100, ge=1, le=500)):
        rows = db.execute(select(GstPurchaseInvoice).order_by(GstPurchaseInvoice.created_at.desc()).limit(limit)).scalars().all()
        return [_purchase_json(row) for row in rows]

    @router.get("/purchases/summary")
    def purchase_summary(db: Session=Depends(get_db), ctx=Depends(actor_context)):
        rows = db.execute(select(GstPurchaseInvoice)).scalars().all()
        return {
            "invoice_count": len(rows),
            "taxable": f"{Decimal(sum(r.taxable_paise for r in rows))/100:.2f}",
            "cgst": f"{Decimal(sum(r.cgst_paise for r in rows))/100:.2f}",
            "sgst": f"{Decimal(sum(r.sgst_paise for r in rows))/100:.2f}",
            "igst": f"{Decimal(sum(r.igst_paise for r in rows))/100:.2f}",
            "cess": f"{Decimal(sum(r.cess_paise for r in rows))/100:.2f}",
            "total": f"{Decimal(sum(r.total_paise for r in rows))/100:.2f}",
            "unmatched": sum(1 for r in rows if r.reconciliation_status not in {"BANK_MATCHED"}),
            "itc_review_required": sum(1 for r in rows if r.itc_review_status == "REVIEW_REQUIRED"),
            "note": "Imported inward GST is observational. No ITC eligibility or claim is inferred.",
        }

    @router.post("/purchases/reconcile")
    def reconcile_purchases(db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        rows = db.execute(select(GstPurchaseInvoice)).scalars().all()
        counts: dict[str, int] = {}
        for row in rows:
            status = _reconcile_row(db, row)
            counts[status] = counts.get(status, 0) + 1
        run = GstReconciliationRun(
            id=uid("GSTRUN"),
            status="COMPLETED",
            summary_json=json.dumps({"count": len(rows), "statuses": counts}, sort_keys=True),
            run_by=ctx["actor"],
        )
        db.add(run)
        audit(db, ctx["actor"], ctx["role"], "gst.purchase_reconciliation.completed", "gst_reconciliation_run", run.id, {"count": len(rows), "statuses": counts}, "CONTROL")
        db.commit()
        return {"id": run.id, "status": run.status, "count": len(rows), "statuses": counts}

    @router.get("/returns")
    def list_return_workings(db: Session=Depends(get_db), ctx=Depends(actor_context)):
        rows = db.execute(select(GstReturnWorking).order_by(GstReturnWorking.period.desc(), GstReturnWorking.form_type)).scalars().all()
        return [_return_json(row) for row in rows]

    @router.post("/returns/build")
    def build_return(payload: ReturnBuildRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        try:
            summary = _build_return_summary(db, payload.form_type, payload.period)
        except ValueError as exc:
            raise HTTPException(422, detail=str(exc))
        source_hash = _hash(summary)
        row = db.execute(select(GstReturnWorking).where(GstReturnWorking.form_type == payload.form_type, GstReturnWorking.period == payload.period)).scalar_one_or_none()
        if row and row.status in {"FILED", "FILED_EVIDENCE_RECORDED"}:
            raise HTTPException(409, "Filed return working is immutable")
        if not row:
            row = GstReturnWorking(id=uid("GSTRET"), form_type=payload.form_type, period=payload.period, prepared_by=ctx["actor"], source_hash=source_hash, summary_json=json.dumps(summary, sort_keys=True))
            db.add(row)
        else:
            row.status = "DRAFT"
            row.source_hash = source_hash
            row.summary_json = json.dumps(summary, sort_keys=True)
            row.prepared_by = ctx["actor"]
            row.reviewed_by = None
            row.reviewed_at = None
        audit(db, ctx["actor"], ctx["role"], "gst.return_working.built", "gst_return_working", row.id, {"form_type": row.form_type, "period": row.period, "source_hash": source_hash}, "CONTROL")
        db.commit()
        return _return_json(row)

    @router.post("/returns/{return_id}/review")
    def review_return(return_id: str, payload: ReturnReviewRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("CA"))):
        row = db.get(GstReturnWorking, return_id)
        if not row:
            raise HTTPException(404, "GST return working not found")
        if row.status in {"FILED", "FILED_EVIDENCE_RECORDED"}:
            raise HTTPException(409, "Filed return working is immutable")
        row.status = "APPROVED_FOR_FILING" if payload.decision == "APPROVE" else "REVIEW_REJECTED"
        row.reviewed_by = ctx["actor"]
        row.reviewed_at = now_utc()
        audit(db, ctx["actor"], ctx["role"], "gst.return_working.reviewed", "gst_return_working", row.id, {"decision": payload.decision, "note": payload.note}, "CONTROL")
        db.commit()
        return _return_json(row)

    @router.post("/returns/{return_id}/filing-evidence")
    def record_filing_evidence(return_id: str, payload: FilingEvidenceRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "CA"))):
        row = db.get(GstReturnWorking, return_id)
        if not row:
            raise HTTPException(404, "GST return working not found")
        if row.status != "APPROVED_FOR_FILING":
            raise HTTPException(409, "Return working must be CA-approved before filing evidence can be recorded")
        row.status = "FILED_EVIDENCE_RECORDED"
        row.filing_provider = payload.provider
        row.filing_arn = payload.arn
        row.filing_evidence_ref = payload.evidence_ref
        row.filed_at = now_utc()
        audit(db, ctx["actor"], ctx["role"], "gst.return.filing_evidence.recorded", "gst_return_working", row.id, {"provider": payload.provider, "arn": payload.arn, "evidence_ref": payload.evidence_ref, "verification": "USER_RECORDED_EXTERNAL_EVIDENCE"}, "CONTROL")
        emit_event(db, "gst.return.filed_evidence", "gst_return_working", row.id, {"form_type": row.form_type, "period": row.period, "arn": payload.arn, "provider": payload.provider})
        db.commit()
        return _return_json(row)

    return router
