"""Authenticated, idempotent server-to-server delivery for public visitor emails."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import os
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth_models import OfficePublicEmailDelivery
from .email_delivery import (
    EmailDeliveryRejected, EmailDeliveryUnavailable, EmailDeliveryUnknown,
    _send_transactional_email,
)
from .public_access_templates import render_public_access_email, TRANSACTIONAL_KINDS


EVENT_PATTERN = re.compile(r"^[A-Za-z0-9:_-]{12,160}$")
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_BODY_BYTES = 4096


class PublicAccessMailPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: str
    event_id: str = Field(min_length=12, max_length=160)
    recipient_email: str = Field(min_length=5, max_length=254)
    recipient_name: str = Field(min_length=2, max_length=120)
    code: str | None = None
    action_url: str | None = Field(default=None, max_length=400)
    resource_title: str | None = Field(default=None, max_length=160)
    message: str | None = Field(default=None, max_length=500)

    @field_validator("event_id")
    @classmethod
    def valid_event_id(cls, value: str) -> str:
        if not EVENT_PATTERN.fullmatch(value):
            raise ValueError("Invalid event ID")
        return value

    @field_validator("recipient_email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("Invalid recipient")
        return normalized

    @model_validator(mode="after")
    def valid_content(self):
        if self.kind not in TRANSACTIONAL_KINDS:
            raise ValueError("Unsupported public mail kind")
        if self.kind == "ACCOUNT_CODE" and (not self.code or not re.fullmatch(r"\d{6}", self.code)):
            raise ValueError("A valid one-time code is required")
        if self.kind == "NEWSLETTER_CONFIRM" and not self.action_url:
            raise ValueError("Confirmation URL is required")
        if self.kind == "DOWNLOAD_RECEIPT" and not self.resource_title:
            raise ValueError("Resource title is required")
        if self.kind == "ACCOUNT_SECURITY" and not self.message:
            raise ValueError("Security notice is required")
        return self


def _secret() -> str:
    value = os.getenv("KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET", "").strip()
    if len(value) < 32:
        raise HTTPException(status_code=503, detail="Public mail delivery is unavailable")
    if value == os.getenv("BREVO_API_KEY", "").strip():
        raise HTTPException(status_code=503, detail="Public mail signing secret is invalid")
    return value


def _verify_request(request: Request, body: bytes, secret: str) -> None:
    if len(body) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Public mail event exceeds size limit")
    timestamp = request.headers.get("x-kravia-public-timestamp", "")
    supplied = request.headers.get("x-kravia-public-signature", "")
    if not timestamp.isdecimal() or not supplied.startswith("v1="):
        raise HTTPException(status_code=401, detail="Unauthorized email event")
    if abs(time.time() - int(timestamp)) > 300:
        raise HTTPException(status_code=401, detail="Expired email event")
    expected = hmac.new(secret.encode("utf-8"), b"public-access-v1." + timestamp.encode("ascii") + b"." + body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(supplied[3:], expected):
        raise HTTPException(status_code=401, detail="Unauthorized email event")


def _fingerprint(secret: str, purpose: str, content: str) -> str:
    return hmac.new(secret.encode("utf-8"), f"{purpose}:{content}".encode(), hashlib.sha256).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def build_public_access_mail_router(get_db) -> APIRouter:
    router = APIRouter(prefix="/api/v1/public-access", tags=["public-access-mail"])

    @router.post("/email", status_code=201)
    async def send_mail(request: Request, db: Session = Depends(get_db)):
        body = await request.body()
        secret = _secret()
        _verify_request(request, body, secret)
        try:
            payload = PublicAccessMailPayload.model_validate_json(body)
            template = render_public_access_email(
                kind=payload.kind,
                recipient_name=payload.recipient_name,
                code=payload.code,
                action_url=payload.action_url,
                resource_title=payload.resource_title,
                message=payload.message,
            )
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="Invalid public email event")

        recipient_hash = _fingerprint(secret, "recipient", payload.recipient_email)
        body_hash = _fingerprint(secret, "event", body.decode("utf-8"))
        existing = db.get(OfficePublicEmailDelivery, payload.event_id)
        if existing:
            if (
                existing.reference != "KRV-PUBLIC-ACCESS"
                or existing.form_kind != "PUBLIC_ACCESS"
                or existing.delivery_kind != payload.kind
                or not hmac.compare_digest(existing.recipient_fingerprint, recipient_hash)
                or not hmac.compare_digest(existing.content_fingerprint or "", body_hash)
            ):
                raise HTTPException(status_code=409, detail="Email event ID collision")
            if existing.status == "SENT":
                return {"delivery": "already_sent"}
            raise HTTPException(status_code=409, detail="Email event has already been processed")

        row = OfficePublicEmailDelivery(
            event_id=payload.event_id,
            reference="KRV-PUBLIC-ACCESS",
            form_kind="PUBLIC_ACCESS",
            delivery_kind=payload.kind,
            content_fingerprint=body_hash,
            recipient_fingerprint=recipient_hash,
            status="PENDING",
        )
        db.add(row)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Email event is already processing")

        try:
            provider_id = _send_transactional_email(
                recipient_email=payload.recipient_email,
                template=template,
                delivery_id=payload.event_id,
                tags=["kravia-public-access", payload.kind.lower()],
            )
        except (EmailDeliveryUnavailable, EmailDeliveryRejected):
            row.status = "DELIVERY_FAILED"
            row.failed_at = _utcnow()
            db.commit()
            raise HTTPException(status_code=503, detail="Email delivery unavailable")
        except EmailDeliveryUnknown:
            row.status = "DELIVERY_UNKNOWN"
            row.failed_at = _utcnow()
            db.commit()
            raise HTTPException(status_code=503, detail="Email delivery outcome is unknown")

        row.status = "SENT"
        row.delivered_at = _utcnow()
        row.provider_message_id = provider_id
        db.commit()
        return {"delivery": "sent"}

    return router
