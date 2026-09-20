"""Fynamics FYN Gateway GST filing adapter for KRAVIA Office.

This is a provider-specific adapter for the currently documented FYN Gateway GST
API surface. Gateway credentials, GST taxpayer authorization tokens, SEK/AppKey,
PAN and OTP are never persisted by this module.

Workflow:
  gateway auth -> taxpayer OTP auth -> CA review -> save -> submit (GSTR-1)
  -> authorized-signatory EVC OTP -> file -> status verification -> ARN.

FILED_VERIFIED is set only after a provider/GSTN status response contains an ARN
and a filed/success state. The final EVC filing contract is version-gated until
the provider-issued integration pack has been acceptance-tested.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Callable
from urllib.parse import quote, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Customer, GstProviderOperation, GstReturnWorking, Invoice, Product
from .services import audit, emit_event, now_utc, uid

PROVIDER = "FYNAMICS"
DOC_VERSION = "3.0.3"
AUTH_PATH = "/authenticate"
REQUEST_OTP_PATH = "/gst/requestOTP"
AUTHTOKEN_PATH = "/gst/authtoken"
SAVE_GSTR1_PATH = "/gst/returns/gstr1"
SUBMIT_GSTR1_PATH = "/gst/returns/gstr1_retsubmit"
FILE_GSTR1_PATH = "/gst/returns/gstr1_filing"
SAVE_GSTR3B_PATH = "/gst/returns/gstr3b"
FILE_GSTR3B_PATH = "/gst/returns/gstr3b_filing"
GSTR1_SUMMARY_PATH = "/gst/returns/gstr1n/{gstin}/{ret_period}/{smrytyp}"
EVC_OTP_PATH = "/gst/returns/authenticate/{gstin}/{pan}/{form_type}"
RETURN_STATUS_PATH = "/gst/get-return-status/{gstin}/{ret_period}/{ref_id}"
GSTR2B_PATH = "/gst/returns/gstr2b/{gstin}/{rtnprd}/{file_num}"
LEDGERS_PATH = "/gst/ledgers/{gstin}/{ret_period}"

FILE_CONTRACT = "fyn-gst-3.0.3-evc"

OFFICIAL_DOCS = {
    "gateway": "https://staging.fynamics.co.in/api-docs/gst",
    "version": DOC_VERSION,
    "provider": "Fynamics Techno Solutions Private Limited",
}


class FynamicsError(RuntimeError):
    def __init__(self, message: str, *, http_status: int | None = None, response_hash: str | None = None):
        super().__init__(message)
        self.http_status = http_status
        self.response_hash = response_hash


@dataclass(frozen=True)
class FynamicsConfig:
    environment: str
    base_url: str
    client_id: str
    client_secret: str
    username: str
    gstin: str
    state_code: str
    ip_usr: str
    timeout_seconds: float
    filing_contract: str
    prev_year_turnover: str
    current_year_turnover: str

    @classmethod
    def from_env(cls) -> "FynamicsConfig":
        return cls(
            environment=os.getenv("GST_GSP_ENVIRONMENT", "sandbox").strip().lower(),
            base_url=os.getenv("GST_GSP_BASE_URL", "https://staging.fynamics.co.in/api").strip().rstrip("/"),
            client_id=os.getenv("GST_GSP_CLIENT_ID", "").strip(),
            client_secret=os.getenv("GST_GSP_CLIENT_SECRET", "").strip(),
            username=os.getenv("GST_GSP_USERNAME", "").strip(),
            gstin=os.getenv("KRAVIA_GSTIN", "").strip().upper(),
            state_code=os.getenv("GST_GSP_STATE_CODE", "").strip(),
            ip_usr=os.getenv("GST_GSP_IP_USR", "").strip(),
            timeout_seconds=float(os.getenv("GST_GSP_TIMEOUT_SECONDS", "20")),
            filing_contract=os.getenv("GST_GSP_FILING_CONTRACT", "").strip(),
            prev_year_turnover=os.getenv("GST_GSTR1_PREV_YEAR_TURNOVER", "").strip(),
            current_year_turnover=os.getenv("GST_GSTR1_CURRENT_YEAR_TURNOVER", "").strip(),
        )

    def missing(self) -> list[str]:
        fields = {
            "GST_GSP_BASE_URL": self.base_url,
            "GST_GSP_CLIENT_ID": self.client_id,
            "GST_GSP_CLIENT_SECRET": self.client_secret,
            "GST_GSP_USERNAME": self.username,
            "KRAVIA_GSTIN": self.gstin,
            "GST_GSP_STATE_CODE": self.state_code,
            "GST_GSP_IP_USR": self.ip_usr,
        }
        return [name for name, value in fields.items() if not value]

    def validate(self) -> None:
        parsed = urlparse(self.base_url)
        local = parsed.hostname in {"localhost", "127.0.0.1"}
        if not parsed.hostname:
            raise FynamicsError("Fynamics base URL is invalid")
        if parsed.scheme != "https" and not (local and os.getenv("APP_ENV", "development") != "production"):
            raise FynamicsError("Fynamics base URL must use HTTPS")
        if self.gstin and not re.fullmatch(r"[0-9A-Z]{15}", self.gstin):
            raise FynamicsError("Configured KRAVIA_GSTIN is invalid")
        if self.state_code and not re.fullmatch(r"[0-9]{2}", self.state_code):
            raise FynamicsError("GST_GSP_STATE_CODE must contain two digits")


@dataclass
class TaxpayerSession:
    authtoken: str
    app_key: str
    sek: str
    expires_at: datetime


_GATEWAY_CACHE: dict[str, tuple[str, datetime]] = {}
_TAXPAYER_CACHE: dict[str, TaxpayerSession] = {}
_LOCK = threading.Lock()


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str).encode("utf-8")


def _digest(value: Any) -> str:
    payload = value if isinstance(value, bytes) else _json_bytes(value)
    return hashlib.sha256(payload).hexdigest()


def _find_first(value: Any, names: set[str]) -> Any:
    lowered_names = {name.lower() for name in names}
    if isinstance(value, dict):
        for key, nested in value.items():
            if str(key).lower() in lowered_names and nested not in (None, ""):
                return nested
        for nested in value.values():
            found = _find_first(nested, lowered_names)
            if found not in (None, ""):
                return found
    elif isinstance(value, list):
        for nested in value:
            found = _find_first(nested, lowered_names)
            if found not in (None, ""):
                return found
    return None


def _rupees(paise: int) -> float:
    return float((Decimal(paise) / Decimal(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _period_mmYYYY(period: str) -> str:
    if not re.fullmatch(r"\d{4}-\d{2}", period):
        raise ValueError("Return period must be YYYY-MM")
    year, month = period.split("-")
    return month + year


def _invoice_date(invoice: Invoice) -> str:
    return invoice.issued_at.astimezone(timezone.utc).strftime("%d-%m-%Y")


def _gst_rate(invoice: Invoice) -> float:
    return float((Decimal(invoice.gst_rate_bps) / Decimal(100)).quantize(Decimal("0.01")))


def _provider_status(body: Any) -> str:
    return str(_find_first(body, {"status", "status_cd", "statusdesc", "status_desc", "requeststatus"}) or "").strip()


def _provider_ref(body: Any) -> str | None:
    value = _find_first(body, {"ref_id", "refid", "referenceid", "reference_id", "requestid", "request_id"})
    return str(value)[:160] if value not in (None, "") else None


def _provider_arn(body: Any) -> str | None:
    value = _find_first(body, {"arn", "filingarn", "filing_arn"})
    return str(value)[:80] if value not in (None, "") else None


def _provider_error_message(body: Any) -> str | None:
    value = _find_first(body, {"message", "error_desc", "errordesc", "desc", "error"})
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True, default=str)[:500]
    return str(value)[:500] if value not in (None, "") else None


def _is_filed_status(status: str) -> bool:
    normalized = re.sub(r"[^A-Z]", "", status.upper())
    return any(word in normalized for word in ("FILED", "SUCCESS", "PROCESSED")) and "FAIL" not in normalized


class FynamicsClient:
    def __init__(self, config: FynamicsConfig, *, transport: httpx.BaseTransport | None = None):
        self.config = config
        self.config.validate()
        self.client = httpx.Client(timeout=config.timeout_seconds, follow_redirects=False, transport=transport)

    def close(self) -> None:
        self.client.close()

    def _url(self, path: str) -> str:
        return self.config.base_url + path

    def _decode(self, response: httpx.Response) -> tuple[dict[str, Any], str]:
        response_hash = _digest(response.content)
        try:
            body = response.json()
        except Exception as exc:
            raise FynamicsError(
                f"Fynamics returned non-JSON HTTP {response.status_code}",
                http_status=response.status_code,
                response_hash=response_hash,
            ) from exc
        if response.status_code >= 400:
            raise FynamicsError(
                _provider_error_message(body) or f"Fynamics HTTP {response.status_code}",
                http_status=response.status_code,
                response_hash=response_hash,
            )
        # Enhanced APIs may return an application-level error on HTTP 200.
        status_cd = str(_find_first(body, {"status_cd"}) or "").strip()
        if status_cd and status_cd not in {"1", "200", "SUCCESS", "S"}:
            err = _provider_error_message(body)
            if err:
                raise FynamicsError(err, http_status=response.status_code, response_hash=response_hash)
        return body, response_hash

    def gateway_token(self, *, force: bool = False) -> str:
        missing = self.config.missing()
        if missing:
            raise FynamicsError("Fynamics GSP configuration is incomplete: " + ", ".join(missing))
        key = _digest({"base": self.config.base_url, "client": self.config.client_id})
        if not force:
            with _LOCK:
                cached = _GATEWAY_CACHE.get(key)
                if cached and cached[1] > now_utc() + timedelta(seconds=60):
                    return cached[0]
        response = self.client.post(
            self._url(AUTH_PATH),
            headers={"clientId": self.config.client_id, "clientSecret": self.config.client_secret, "Accept": "application/json"},
        )
        body, _ = self._decode(response)
        token = _find_first(body, {"access_token", "accesstoken", "token", "bearer_token", "jwt"})
        if not token:
            raise FynamicsError("Fynamics authentication response did not contain a gateway token")
        token = str(token)
        expires_in = _find_first(body, {"expires_in", "expiresin", "expiry"})
        try:
            seconds = int(expires_in)
            seconds = max(300, min(seconds, 86400))
        except Exception:
            seconds = 3500
        with _LOCK:
            _GATEWAY_CACHE[key] = (token, now_utc() + timedelta(seconds=seconds))
        return token

    def _gateway_headers(self) -> dict[str, str]:
        return {
            "Authorization": "Bearer " + self.gateway_token(),
            "Accept": "application/json",
            "Content-Type": "application/json",
            "ip-usr": self.config.ip_usr,
            "state-cd": self.config.state_code,
        }

    def request_taxpayer_otp(self) -> tuple[dict[str, Any], str]:
        response = self.client.post(
            self._url(REQUEST_OTP_PATH),
            headers=self._gateway_headers(),
            json={"action": "OTPREQUEST", "username": self.config.username},
        )
        return self._decode(response)

    def authorize_taxpayer(self, otp: str) -> tuple[dict[str, Any], str]:
        response = self.client.post(
            self._url(AUTHTOKEN_PATH),
            headers=self._gateway_headers(),
            json={"action": "AUTHTOKEN", "username": self.config.username, "otp": otp},
        )
        body, response_hash = self._decode(response)
        authtoken = _find_first(body, {"authtoken", "auth_token"})
        sek = _find_first(body, {"sek"})
        app_key = _find_first(body, {"app_key", "appkey"})
        if not authtoken or not sek or not app_key:
            raise FynamicsError("Fynamics taxpayer authorization response is missing authtoken, SEK or app_key")
        session = TaxpayerSession(
            authtoken=str(authtoken),
            app_key=str(app_key),
            sek=str(sek),
            expires_at=now_utc() + timedelta(hours=5, minutes=50),
        )
        with _LOCK:
            _TAXPAYER_CACHE[self.config.gstin] = session
        return body, response_hash

    def taxpayer_session(self) -> TaxpayerSession:
        with _LOCK:
            session = _TAXPAYER_CACHE.get(self.config.gstin)
            if session and session.expires_at > now_utc() + timedelta(seconds=60):
                return session
        raise FynamicsError("GST taxpayer session is not authenticated; request and verify OTP first")

    def _gst_headers(self, ret_period: str | None = None) -> dict[str, str]:
        session = self.taxpayer_session()
        headers = {
            **self._gateway_headers(),
            "gstin": self.config.gstin,
            "username": self.config.username,
            "authtoken": session.authtoken,
            "app_key": session.app_key,
            "sek": session.sek,
        }
        if ret_period:
            headers["rtnprd"] = ret_period
            headers["ret_period"] = ret_period
        return headers

    def save_return(self, form_type: str, ret_period: str, payload: dict[str, Any]) -> tuple[dict[str, Any], str]:
        path = SAVE_GSTR1_PATH if form_type == "GSTR1" else SAVE_GSTR3B_PATH
        response = self.client.put(self._url(path), headers=self._gst_headers(ret_period), json=payload)
        return self._decode(response)

    def submit_gstr1(self, ret_period: str) -> tuple[dict[str, Any], str]:
        response = self.client.post(
            self._url(SUBMIT_GSTR1_PATH),
            headers=self._gst_headers(ret_period),
            json={"gstin": self.config.gstin, "ret_period": ret_period},
        )
        return self._decode(response)

    def get_gstr1_summary(self, ret_period: str) -> tuple[dict[str, Any], str]:
        path = GSTR1_SUMMARY_PATH.format(
            gstin=quote(self.config.gstin, safe=""),
            ret_period=quote(ret_period, safe=""),
            smrytyp="L",
        )
        response = self.client.get(self._url(path), headers=self._gst_headers(ret_period))
        return self._decode(response)

    def request_evc_otp(self, pan: str, form_type: str) -> tuple[dict[str, Any], str]:
        path = EVC_OTP_PATH.format(
            gstin=quote(self.config.gstin, safe=""),
            pan=quote(pan, safe=""),
            form_type=quote(form_type, safe=""),
        )
        response = self.client.get(self._url(path), headers=self._gst_headers())
        return self._decode(response)

    def file_return(self, form_type: str, ret_period: str, pan: str, otp: str) -> tuple[dict[str, Any], str]:
        if self.config.filing_contract != FILE_CONTRACT:
            raise FynamicsError(
                "Final EVC filing is disabled until GST_GSP_FILING_CONTRACT="
                + FILE_CONTRACT
                + " is acceptance-tested for this Fynamics account"
            )
        if form_type == "GSTR1":
            summary, _ = self.get_gstr1_summary(ret_period)
            chksum = _find_first(summary, {"chksum", "checksum"})
            sec_sum = _find_first(summary, {"sec_sum", "secsum", "section_summary"})
            if not chksum or sec_sum is None:
                raise FynamicsError("Fynamics GSTR-1 summary is missing checksum/section summary required for EVC filing")
            payload = {
                "gstin": self.config.gstin,
                "ret_period": ret_period,
                "summ_typ": "L",
                "chksum": chksum,
                "sec_sum": sec_sum,
                "pan": pan,
                "otp": otp,
            }
            path = FILE_GSTR1_PATH
        else:
            payload = {
                "gstin": self.config.gstin,
                "ret_period": ret_period,
                "pan": pan,
                "otp": otp,
            }
            path = FILE_GSTR3B_PATH
        response = self.client.put(self._url(path), headers=self._gst_headers(ret_period), json=payload)
        return self._decode(response)

    def get_return_status(self, ret_period: str, ref_id: str) -> tuple[dict[str, Any], str]:
        path = RETURN_STATUS_PATH.format(
            gstin=quote(self.config.gstin, safe=""),
            ret_period=quote(ret_period, safe=""),
            ref_id=quote(ref_id, safe=""),
        )
        response = self.client.get(self._url(path), headers=self._gst_headers(ret_period))
        return self._decode(response)

    def get_gstr2b(self, ret_period: str, file_num: str = "1") -> tuple[dict[str, Any], str]:
        path = GSTR2B_PATH.format(
            gstin=quote(self.config.gstin, safe=""),
            rtnprd=quote(ret_period, safe=""),
            file_num=quote(file_num, safe=""),
        )
        response = self.client.get(self._url(path), headers=self._gst_headers(ret_period))
        return self._decode(response)

    def get_ledgers(self, ret_period: str) -> tuple[dict[str, Any], str]:
        path = LEDGERS_PATH.format(gstin=quote(self.config.gstin, safe=""), ret_period=quote(ret_period, safe=""))
        response = self.client.get(self._url(path), headers=self._gst_headers(ret_period))
        return self._decode(response)


def _invoice_itm(invoice: Invoice) -> dict[str, Any]:
    return {
        "num": 1,
        "itm_det": {
            "txval": _rupees(invoice.net_taxable_paise),
            "rt": _gst_rate(invoice),
            "iamt": _rupees(invoice.igst_paise),
            "camt": _rupees(invoice.cgst_paise),
            "samt": _rupees(invoice.sgst_paise),
            "csamt": 0.0,
        },
    }


def _invoice_obj(invoice: Invoice, customer: Customer) -> dict[str, Any]:
    return {
        "inum": invoice.invoice_no,
        "idt": _invoice_date(invoice),
        "val": _rupees(invoice.total_paise),
        "pos": customer.state_code,
        "rchrg": "N",
        "inv_typ": "R",
        "itms": [_invoice_itm(invoice)],
    }


def build_gstr1_payload(db: Session, row: GstReturnWorking, config: FynamicsConfig) -> dict[str, Any]:
    if not config.prev_year_turnover or not config.current_year_turnover:
        if os.getenv("APP_ENV", "development").strip().lower() == "production":
            raise FynamicsError("GSTR-1 turnover configuration is required before production upload")
    ret_period = _period_mmYYYY(row.period)
    invoices = [
        invoice
        for invoice in db.execute(select(Invoice)).scalars().all()
        if invoice.issued_at
        and invoice.issued_at.strftime("%Y-%m") == row.period
        and invoice.status != "CANCELLED"
    ]
    customers = {c.id: c for c in db.execute(select(Customer)).scalars().all()}
    products = {p.id: p for p in db.execute(select(Product)).scalars().all()}

    b2b_map: dict[str, list[dict[str, Any]]] = {}
    b2cl: list[dict[str, Any]] = []
    b2cs_map: dict[tuple[str, float, str], dict[str, Any]] = {}
    hsn_map: dict[tuple[str, float, str], dict[str, Any]] = {}

    period_date = datetime.strptime(row.period + "-01", "%Y-%m-%d").date()
    b2cl_threshold_paise = 10_000_000 if period_date >= datetime(2024, 8, 1).date() else 25_000_000

    for invoice in invoices:
        customer = customers.get(invoice.customer_id)
        if not customer:
            raise FynamicsError(f"Customer missing for invoice {invoice.invoice_no}")
        registered = bool(customer.gstin)
        interstate = invoice.igst_paise > 0
        if registered:
            b2b_map.setdefault(str(customer.gstin), []).append(_invoice_obj(invoice, customer))
        elif interstate and invoice.total_paise > b2cl_threshold_paise:
            b2cl.append({
                "pos": customer.state_code,
                "inv": [_invoice_obj(invoice, customer)],
            })
        else:
            key = ("INTER" if interstate else "INTRA", _gst_rate(invoice), customer.state_code)
            bucket = b2cs_map.setdefault(key, {
                "sply_ty": key[0],
                "typ": "OE",
                "pos": customer.state_code,
                "rt": key[1],
                "txval": 0.0,
                "iamt": 0.0,
                "camt": 0.0,
                "samt": 0.0,
                "csamt": 0.0,
            })
            bucket["txval"] = round(bucket["txval"] + _rupees(invoice.net_taxable_paise), 2)
            bucket["iamt"] = round(bucket["iamt"] + _rupees(invoice.igst_paise), 2)
            bucket["camt"] = round(bucket["camt"] + _rupees(invoice.cgst_paise), 2)
            bucket["samt"] = round(bucket["samt"] + _rupees(invoice.sgst_paise), 2)

        product = products.get(invoice.product_id)
        desc = (product.name if product else invoice.description)[:30]
        hsn_key = (str(invoice.sac or ""), _gst_rate(invoice), desc)
        hsn = hsn_map.setdefault(hsn_key, {
            "num": len(hsn_map) + 1,
            "hsn_sc": hsn_key[0],
            "desc": desc,
            "uqc": "OTH",
            "qty": 0.0,
            "val": 0.0,
            "txval": 0.0,
            "iamt": 0.0,
            "camt": 0.0,
            "samt": 0.0,
            "csamt": 0.0,
            "rt": hsn_key[1],
        })
        hsn["qty"] = round(hsn["qty"] + float(Decimal(invoice.qty_milli) / Decimal(1000)), 3)
        hsn["val"] = round(hsn["val"] + _rupees(invoice.total_paise), 2)
        hsn["txval"] = round(hsn["txval"] + _rupees(invoice.net_taxable_paise), 2)
        hsn["iamt"] = round(hsn["iamt"] + _rupees(invoice.igst_paise), 2)
        hsn["camt"] = round(hsn["camt"] + _rupees(invoice.cgst_paise), 2)
        hsn["samt"] = round(hsn["samt"] + _rupees(invoice.sgst_paise), 2)

    invoice_numbers = sorted((inv.invoice_no for inv in invoices))
    doc_issue = []
    if invoice_numbers:
        doc_issue = [{
            "doc_num": 1,
            "docs": [{
                "num": 1,
                "from": invoice_numbers[0],
                "to": invoice_numbers[-1],
                "totnum": len(invoice_numbers),
                "cancel": 0,
                "net_issue": len(invoice_numbers),
            }],
        }]

    payload: dict[str, Any] = {
        "gstin": config.gstin,
        "fp": ret_period,
        "gt": float(Decimal(config.prev_year_turnover or "0")),
        "cur_gt": float(Decimal(config.current_year_turnover or "0")),
    }
    if b2b_map:
        payload["b2b"] = [{"ctin": ctin, "inv": invs} for ctin, invs in sorted(b2b_map.items())]
    if b2cl:
        payload["b2cl"] = b2cl
    if b2cs_map:
        payload["b2cs"] = list(b2cs_map.values())
    if hsn_map:
        payload["hsn"] = {"data": list(hsn_map.values())}
    if doc_issue:
        payload["doc_issue"] = {"doc_det": doc_issue}
    return payload


def build_gstr3b_payload(db: Session, row: GstReturnWorking, config: FynamicsConfig) -> dict[str, Any]:
    if not row.itc_review_json or not row.itc_reviewed_at:
        raise FynamicsError("CA ITC review is required before GSTR-3B can be uploaded")
    review = json.loads(row.itc_review_json)
    all_sales = db.execute(select(Invoice)).scalars().all()
    sales = [
        inv for inv in all_sales
        if inv.issued_at and inv.issued_at.strftime("%Y-%m") == row.period and inv.status != "CANCELLED"
    ]
    txval = sum(inv.net_taxable_paise for inv in sales)
    iamt = sum(inv.igst_paise for inv in sales)
    camt = sum(inv.cgst_paise for inv in sales)
    samt = sum(inv.sgst_paise for inv in sales)
    return {
        "gstin": config.gstin,
        "ret_period": _period_mmYYYY(row.period),
        "sup_details": {
            "osup_det": {"txval": _rupees(txval), "iamt": _rupees(iamt), "camt": _rupees(camt), "samt": _rupees(samt), "csamt": 0.0},
            "osup_zero": {"txval": 0.0, "iamt": 0.0, "csamt": 0.0},
            "osup_nil_exmp": {"txval": 0.0},
            "isup_rev": {"txval": 0.0, "iamt": 0.0, "camt": 0.0, "samt": 0.0, "csamt": 0.0},
            "osup_nongst": {"txval": 0.0},
        },
        "itc_elg": {
            "itc_avl": [{
                "ty": "OTH",
                "iamt": float(Decimal(review.get("igst", "0"))),
                "camt": float(Decimal(review.get("cgst", "0"))),
                "samt": float(Decimal(review.get("sgst", "0"))),
                "csamt": float(Decimal(review.get("cess", "0"))),
            }],
            "itc_rev": [],
            "itc_net": {
                "iamt": float(Decimal(review.get("igst", "0"))),
                "camt": float(Decimal(review.get("cgst", "0"))),
                "samt": float(Decimal(review.get("sgst", "0"))),
                "csamt": float(Decimal(review.get("cess", "0"))),
            },
            "itc_inelg": [],
        },
        "inward_sup": {"isup_details": []},
        "intr_ltfee": {"intr_details": {"iamt": 0.0, "camt": 0.0, "samt": 0.0, "csamt": 0.0}},
    }


def _operation(
    db: Session,
    config: FynamicsConfig,
    ctx: dict[str, Any],
    operation: str,
    status: str,
    *,
    entity_id: str | None = None,
    request_hash: str | None = None,
    response_hash: str | None = None,
    error: str | None = None,
) -> None:
    db.add(GstProviderOperation(
        id=uid("GSTOP"),
        provider=PROVIDER,
        provider_environment=config.environment,
        operation=operation,
        entity_type="gst_return_working" if entity_id else "integration",
        entity_id=entity_id,
        status=status,
        request_hash=request_hash,
        response_hash=response_hash,
        error_message=error[:500] if error else None,
        actor=ctx["actor"],
    ))


class OtpRequest(BaseModel):
    otp: str = Field(pattern=r"^[0-9]{4,8}$")


class ItcReviewRequest(BaseModel):
    igst: Decimal = Field(default=Decimal("0"), ge=0)
    cgst: Decimal = Field(default=Decimal("0"), ge=0)
    sgst: Decimal = Field(default=Decimal("0"), ge=0)
    cess: Decimal = Field(default=Decimal("0"), ge=0)
    evidence_ref: str = Field(min_length=3, max_length=2000)
    note: str = Field(min_length=3, max_length=2000)


class EvcRequest(BaseModel):
    pan: str = Field(pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")


class EvcFileRequest(BaseModel):
    pan: str = Field(pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")
    otp: str = Field(pattern=r"^[0-9]{4,8}$")


def _return_state_json(row: GstReturnWorking) -> dict[str, Any]:
    return {
        "id": row.id,
        "form_type": row.form_type,
        "period": row.period,
        "status": row.status,
        "filing_provider": row.filing_provider,
        "filing_arn": row.filing_arn,
        "gsp_submission_ref": row.gsp_submission_ref,
        "gsp_response_hash": row.gsp_response_hash,
        "gsp_verified_status": row.gsp_verified_status,
        "gsp_last_sync_at": row.gsp_last_sync_at.isoformat() if row.gsp_last_sync_at else None,
        "gsp_verified_at": row.gsp_verified_at.isoformat() if row.gsp_verified_at else None,
        "itc_reviewed_by": row.itc_reviewed_by,
        "itc_reviewed_at": row.itc_reviewed_at.isoformat() if row.itc_reviewed_at else None,
    }


def build_fynamics_gsp_router(get_db: Callable, actor_context: Callable, require_roles: Callable) -> APIRouter:
    router = APIRouter(prefix="/api/v1/tax/gst/gsp", tags=["GST GSP Filing"])

    @router.get("/status")
    def status(ctx=Depends(actor_context)):
        config = FynamicsConfig.from_env()
        missing = config.missing()
        with _LOCK:
            session = _TAXPAYER_CACHE.get(config.gstin)
            authenticated = bool(session and session.expires_at > now_utc() + timedelta(seconds=60))
        return {
            "provider": PROVIDER,
            "provider_name": OFFICIAL_DOCS["provider"],
            "api_version": DOC_VERSION,
            "environment": config.environment,
            "configured": not missing,
            "missing_configuration": missing,
            "taxpayer_authenticated": authenticated,
            "filing_contract": config.filing_contract or None,
            "filing_contract_ready": config.filing_contract == FILE_CONTRACT,
            "capabilities": {
                "taxpayer_otp_auth": True,
                "gstr1_save": True,
                "gstr1_submit": True,
                "gstr1_evc_file": config.filing_contract == FILE_CONTRACT,
                "gstr3b_save": True,
                "gstr3b_evc_file": config.filing_contract == FILE_CONTRACT,
                "gstr2b": True,
                "ledgers": True,
                "return_status": True,
            },
            "secret_storage": "gateway/taxpayer tokens, SEK/AppKey, PAN and OTP are memory-only/transient",
            "official_docs": OFFICIAL_DOCS,
        }

    @router.post("/taxpayer/request-otp")
    def request_taxpayer_otp(db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        config = FynamicsConfig.from_env()
        if config.missing():
            raise HTTPException(409, "Fynamics GSP is not configured: " + ", ".join(config.missing()))
        client = FynamicsClient(config)
        try:
            body, response_hash = client.request_taxpayer_otp()
            _operation(db, config, ctx, "TAXPAYER_OTP_REQUEST", "SUCCEEDED", response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.gsp.taxpayer_otp.requested", "integration", PROVIDER, {"provider": PROVIDER, "response_hash": response_hash}, "CONTROL")
            db.commit()
            return {"status": "OTP_SENT", "provider": PROVIDER}
        except FynamicsError as exc:
            _operation(db, config, ctx, "TAXPAYER_OTP_REQUEST", "FAILED", error=str(exc), response_hash=exc.response_hash)
            db.commit()
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.post("/taxpayer/auth")
    def authorize_taxpayer(payload: OtpRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        config = FynamicsConfig.from_env()
        if config.missing():
            raise HTTPException(409, "Fynamics GSP is not configured: " + ", ".join(config.missing()))
        client = FynamicsClient(config)
        try:
            _, response_hash = client.authorize_taxpayer(payload.otp)
            _operation(db, config, ctx, "TAXPAYER_AUTH", "SUCCEEDED", response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.gsp.taxpayer_authenticated", "integration", PROVIDER, {"provider": PROVIDER, "response_hash": response_hash}, "CONTROL")
            db.commit()
            return {"status": "AUTHENTICATED", "provider": PROVIDER}
        except FynamicsError as exc:
            _operation(db, config, ctx, "TAXPAYER_AUTH", "FAILED", error=str(exc), response_hash=exc.response_hash)
            db.commit()
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.post("/returns/{return_id}/itc-review")
    def review_itc(return_id: str, payload: ItcReviewRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("CA"))):
        row = db.get(GstReturnWorking, return_id)
        if not row:
            raise HTTPException(404, "GST return working not found")
        if row.form_type != "GSTR3B":
            raise HTTPException(409, "ITC review applies only to GSTR-3B workings")
        if row.status in {"FILED", "FILED_EVIDENCE_RECORDED", "FILED_VERIFIED"}:
            raise HTTPException(409, "Filed return working is immutable")
        evidence = {
            "igst": str(payload.igst),
            "cgst": str(payload.cgst),
            "sgst": str(payload.sgst),
            "cess": str(payload.cess),
            "evidence_ref": payload.evidence_ref,
            "note": payload.note,
        }
        row.itc_review_json = json.dumps(evidence, sort_keys=True)
        row.itc_reviewed_by = ctx["actor"]
        row.itc_reviewed_at = now_utc()
        audit(db, ctx["actor"], ctx["role"], "gst.itc.reviewed", "gst_return_working", row.id, {"evidence_ref": payload.evidence_ref, "approved_amounts": {k: evidence[k] for k in ("igst","cgst","sgst","cess")}}, "CONTROL")
        db.commit()
        return _return_state_json(row)

    @router.post("/returns/{return_id}/save")
    def save_return(return_id: str, db: Session=Depends(get_db), ctx=Depends(require_roles("CA"))):
        row = db.get(GstReturnWorking, return_id)
        if not row:
            raise HTTPException(404, "GST return working not found")
        if row.status != "APPROVED_FOR_FILING":
            raise HTTPException(409, "CA-approved return working is required before GSP upload")
        config = FynamicsConfig.from_env()
        if config.missing():
            raise HTTPException(409, "Fynamics GSP is not configured: " + ", ".join(config.missing()))
        try:
            provider_payload = build_gstr1_payload(db, row, config) if row.form_type == "GSTR1" else build_gstr3b_payload(db, row, config)
        except (FynamicsError, ValueError) as exc:
            raise HTTPException(409, detail=str(exc))
        request_hash = _digest(provider_payload)
        client = FynamicsClient(config)
        try:
            body, response_hash = client.save_return(row.form_type, _period_mmYYYY(row.period), provider_payload)
            ref_id = _provider_ref(body)
            row.status = "GSP_SAVED"
            row.filing_provider = PROVIDER
            row.gsp_submission_ref = ref_id
            row.gsp_response_hash = response_hash
            row.gsp_status_json = json.dumps(body, sort_keys=True, default=str)
            row.gsp_last_sync_at = now_utc()
            _operation(db, config, ctx, "RETURN_SAVE", "SUCCEEDED", entity_id=row.id, request_hash=request_hash, response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.gsp.return.saved", "gst_return_working", row.id, {"provider": PROVIDER, "ref_id": ref_id, "request_hash": request_hash, "response_hash": response_hash}, "CONTROL")
            db.commit()
            return _return_state_json(row)
        except FynamicsError as exc:
            _operation(db, config, ctx, "RETURN_SAVE", "FAILED", entity_id=row.id, request_hash=request_hash, response_hash=exc.response_hash, error=str(exc))
            db.commit()
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.post("/returns/{return_id}/submit")
    def submit_return(return_id: str, db: Session=Depends(get_db), ctx=Depends(require_roles("CA"))):
        row = db.get(GstReturnWorking, return_id)
        if not row:
            raise HTTPException(404, "GST return working not found")
        if row.form_type != "GSTR1":
            raise HTTPException(409, "Explicit submit stage is currently documented for GSTR-1 only")
        if row.status != "GSP_SAVED":
            raise HTTPException(409, "GSTR-1 must be saved through the GSP before submit")
        config = FynamicsConfig.from_env()
        client = FynamicsClient(config)
        try:
            body, response_hash = client.submit_gstr1(_period_mmYYYY(row.period))
            ref_id = _provider_ref(body) or row.gsp_submission_ref
            row.status = "GSP_SUBMITTED"
            row.gsp_submission_ref = ref_id
            row.gsp_response_hash = response_hash
            row.gsp_status_json = json.dumps(body, sort_keys=True, default=str)
            row.gsp_last_sync_at = now_utc()
            _operation(db, config, ctx, "RETURN_SUBMIT", "SUCCEEDED", entity_id=row.id, response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.gsp.return.submitted", "gst_return_working", row.id, {"provider": PROVIDER, "ref_id": ref_id, "response_hash": response_hash}, "CONTROL")
            db.commit()
            return _return_state_json(row)
        except FynamicsError as exc:
            _operation(db, config, ctx, "RETURN_SUBMIT", "FAILED", entity_id=row.id, response_hash=exc.response_hash, error=str(exc))
            db.commit()
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.post("/returns/{return_id}/evc/request")
    def request_evc(return_id: str, payload: EvcRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER"))):
        row = db.get(GstReturnWorking, return_id)
        if not row:
            raise HTTPException(404, "GST return working not found")
        allowed = {"GSP_SUBMITTED"} if row.form_type == "GSTR1" else {"GSP_SAVED"}
        if row.status not in allowed:
            raise HTTPException(409, "Return is not ready for authorized-signatory EVC")
        config = FynamicsConfig.from_env()
        client = FynamicsClient(config)
        try:
            _, response_hash = client.request_evc_otp(payload.pan, row.form_type)
            row.status = "EVC_REQUESTED"
            row.gsp_response_hash = response_hash
            row.gsp_last_sync_at = now_utc()
            _operation(db, config, ctx, "EVC_OTP_REQUEST", "SUCCEEDED", entity_id=row.id, response_hash=response_hash)
            # PAN is intentionally excluded from persistent audit detail.
            audit(db, ctx["actor"], ctx["role"], "gst.gsp.evc.requested", "gst_return_working", row.id, {"provider": PROVIDER, "form_type": row.form_type, "response_hash": response_hash}, "CONTROL")
            db.commit()
            return _return_state_json(row)
        except FynamicsError as exc:
            _operation(db, config, ctx, "EVC_OTP_REQUEST", "FAILED", entity_id=row.id, response_hash=exc.response_hash, error=str(exc))
            db.commit()
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.post("/returns/{return_id}/file")
    def file_return(return_id: str, payload: EvcFileRequest, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER"))):
        row = db.get(GstReturnWorking, return_id)
        if not row:
            raise HTTPException(404, "GST return working not found")
        if row.status != "EVC_REQUESTED":
            raise HTTPException(409, "EVC OTP must be requested before filing")
        config = FynamicsConfig.from_env()
        client = FynamicsClient(config)
        try:
            body, response_hash = client.file_return(row.form_type, _period_mmYYYY(row.period), payload.pan, payload.otp)
            ref_id = _provider_ref(body) or row.gsp_submission_ref
            arn = _provider_arn(body)
            status = _provider_status(body)
            row.status = "GSP_FILE_REQUESTED"
            row.filing_provider = PROVIDER
            row.gsp_submission_ref = ref_id
            row.gsp_response_hash = response_hash
            row.gsp_status_json = json.dumps(body, sort_keys=True, default=str)
            row.gsp_last_sync_at = now_utc()
            # OTP and PAN are intentionally not persisted.
            if arn and _is_filed_status(status):
                row.status = "FILED_VERIFIED"
                row.filing_arn = arn
                row.filed_at = now_utc()
                row.gsp_verified_at = now_utc()
                row.gsp_verified_status = status or "FILED"
            _operation(db, config, ctx, "RETURN_FILE", "SUCCEEDED", entity_id=row.id, response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.gsp.return.file_requested", "gst_return_working", row.id, {"provider": PROVIDER, "ref_id": ref_id, "arn": arn, "provider_status": status, "response_hash": response_hash}, "CONTROL")
            if row.status == "FILED_VERIFIED":
                emit_event(db, "gst.return.filed_verified", "gst_return_working", row.id, {"form_type": row.form_type, "period": row.period, "arn": arn, "provider": PROVIDER})
            db.commit()
            return _return_state_json(row)
        except FynamicsError as exc:
            _operation(db, config, ctx, "RETURN_FILE", "FAILED", entity_id=row.id, response_hash=exc.response_hash, error=str(exc))
            db.commit()
            raise HTTPException(409 if "disabled until" in str(exc) else 502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.post("/returns/{return_id}/verify")
    def verify_return(return_id: str, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        row = db.get(GstReturnWorking, return_id)
        if not row:
            raise HTTPException(404, "GST return working not found")
        if not row.gsp_submission_ref:
            raise HTTPException(409, "No GSP submission reference is available for verification")
        config = FynamicsConfig.from_env()
        client = FynamicsClient(config)
        try:
            body, response_hash = client.get_return_status(_period_mmYYYY(row.period), row.gsp_submission_ref)
            arn = _provider_arn(body)
            status = _provider_status(body)
            row.gsp_response_hash = response_hash
            row.gsp_status_json = json.dumps(body, sort_keys=True, default=str)
            row.gsp_last_sync_at = now_utc()
            row.gsp_verified_status = status or None
            if arn and _is_filed_status(status):
                row.status = "FILED_VERIFIED"
                row.filing_provider = PROVIDER
                row.filing_arn = arn
                row.filed_at = row.filed_at or now_utc()
                row.gsp_verified_at = now_utc()
                emit_event(db, "gst.return.filed_verified", "gst_return_working", row.id, {"form_type": row.form_type, "period": row.period, "arn": arn, "provider": PROVIDER})
            _operation(db, config, ctx, "RETURN_STATUS", "SUCCEEDED", entity_id=row.id, response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.gsp.return.status_verified", "gst_return_working", row.id, {"provider": PROVIDER, "provider_status": status, "arn": arn, "response_hash": response_hash}, "CONTROL")
            db.commit()
            return _return_state_json(row)
        except FynamicsError as exc:
            _operation(db, config, ctx, "RETURN_STATUS", "FAILED", entity_id=row.id, response_hash=exc.response_hash, error=str(exc))
            db.commit()
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.get("/gstr2b/{period}")
    def get_gstr2b(period: str, file_num: str = "1", db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        config = FynamicsConfig.from_env()
        try:
            ret_period = _period_mmYYYY(period)
        except ValueError as exc:
            raise HTTPException(422, detail=str(exc))
        client = FynamicsClient(config)
        try:
            body, response_hash = client.get_gstr2b(ret_period, file_num)
            _operation(db, config, ctx, "GSTR2B_GET", "SUCCEEDED", response_hash=response_hash)
            audit(db, ctx["actor"], ctx["role"], "gst.gsp.gstr2b.read", "gst_period", period, {"provider": PROVIDER, "response_hash": response_hash}, "CONTROL")
            db.commit()
            return {"provider": PROVIDER, "period": period, "response_hash": response_hash, "data": body}
        except FynamicsError as exc:
            _operation(db, config, ctx, "GSTR2B_GET", "FAILED", response_hash=exc.response_hash, error=str(exc))
            db.commit()
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    @router.get("/ledgers/{period}")
    def get_ledgers(period: str, db: Session=Depends(get_db), ctx=Depends(require_roles("OWNER", "FINANCE", "CA"))):
        config = FynamicsConfig.from_env()
        try:
            ret_period = _period_mmYYYY(period)
        except ValueError as exc:
            raise HTTPException(422, detail=str(exc))
        client = FynamicsClient(config)
        try:
            body, response_hash = client.get_ledgers(ret_period)
            _operation(db, config, ctx, "LEDGERS_GET", "SUCCEEDED", response_hash=response_hash)
            db.commit()
            return {"provider": PROVIDER, "period": period, "response_hash": response_hash, "data": body}
        except FynamicsError as exc:
            _operation(db, config, ctx, "LEDGERS_GET", "FAILED", response_hash=exc.response_hash, error=str(exc))
            db.commit()
            raise HTTPException(502, detail=str(exc)[:500])
        finally:
            client.close()

    return router
