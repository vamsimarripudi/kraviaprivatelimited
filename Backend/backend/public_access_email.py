"""Signed, idempotent KRAVIA public visitor email delivery.

Only the trusted Next.js server may submit messages. All HTML is selected from
the committed canonical manifest and runtime values are escaped and validated.
There is no browser-facing arbitrary-recipient email endpoint.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .email_delivery import (
    EmailDeliveryRejected,
    EmailDeliveryUnknown,
    EmailDeliveryUnavailable,
    _send_transactional_email,
)
from .email_templates import PUBLIC_ACCESS_MAIL_TYPES, public_access_mail_template

_EVENT_ID = re.compile(r"^[A-Za-z0-9:_-]{12,160}$")
_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_MAX_BODY = 8192
_TTL_SECONDS = 300


class PublicAccessMail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: str = Field(min_length=8, max_length=40)
    event_id: str = Field(min_length=12, max_length=160)
    recipient_email: str = Field(min_length=3, max_length=254)
    recipient_name: str = Field(min_length=2, max_length=120)
    code: str | None = Field(default=None, max_length=6)
    action_url: str | None = Field(default=None, max_length=512)
    resource_title: str | None = Field(default=None, max_length=160)


def _mail_secret() -> str:
    secret = os.getenv("KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET", "").strip()
    if len(secret) < 32:
        raise HTTPException(503, "Signed public email delivery is not configured")
    return secret


def _validate_signature(request: Request, body: bytes) -> str:
    if len(body) > _MAX_BODY:
        raise HTTPException(413, "Email event is too large")
    secret = _mail_secret()
    timestamp = request.headers.get("x-kravia-public-timestamp", "")
    supplied = request.headers.get("x-kravia-public-signature", "")
    if not timestamp.isdecimal() or len(timestamp) > 12 or abs(int(timestamp)-int(time.time())) > _TTL_SECONDS:
        raise HTTPException(403, "Invalid email event timestamp")
    expected = hmac.new(secret.encode("utf8"),
        b"public-access-v1." + timestamp.encode("ascii") + b"." + body,
        hashlib.sha256).hexdigest()
    if not hmac.compare_digest(supplied, "v1=" + expected):
        raise HTTPException(403, "Invalid signed email event")
    return secret


def _fingerprint(secret: str, email: str) -> str:
    return hmac.new(secret.encode("utf8"), ("public-recipient:" + email).encode("utf8"),
        hashlib.sha256).hexdigest()


def build_public_access_email_router(get_db) -> APIRouter:
    router = APIRouter(prefix="/api/v1/public-access", tags=["public-access-email"])

    @router.post("/email", status_code=201)
    async def deliver_public_email(request: Request, db: Session = Depends(get_db)):
        body = await request.body()
        secret = _validate_signature(request, body)
        try:
            payload = PublicAccessMail.model_validate(json.loads(body))
        except (ValueError, UnicodeError):
            raise HTTPException(400, "Invalid public access email event") from None
        if payload.kind not in PUBLIC_ACCESS_MAIL_TYPES or not _EVENT_ID.fullmatch(payload.event_id):
            raise HTTPException(400, "Unsupported public access email event")
        email = payload.recipient_email.strip().lower()
        if not _EMAIL.fullmatch(email):
            raise HTTPException(400, "Invalid recipient")
        try:
            template = public_access_mail_template(
                kind=payload.kind,
                recipient_name=payload.recipient_name,
                code=payload.code,
                action_url=payload.action_url,
                resource_title=payload.resource_title,
            )
        except ValueError:
            raise HTTPException(400, "Invalid email fields") from None
        recipient_hash = _fingerprint(secret, email)
        current = db.execute(
            text("select recipient_fingerprint,mail_kind,status from office_public_access_email_deliveries where event_id=:id"),
            {"id": payload.event_id},
        ).mappings().first()
        if current is not None:
            if current["recipient_fingerprint"] != recipient_hash or current["mail_kind"] != payload.kind:
                raise HTTPException(409, "Email event identifier already exists")
            if current["status"] == "DELIVERED":
                return {"accepted": True, "duplicate": True}
            raise HTTPException(409, "Email event is already being handled")

        try:
            db.execute(text(
                "insert into office_public_access_email_deliveries"
                "(event_id,recipient_fingerprint,mail_kind,status)"
                " values (:id,:fingerprint,:kind,'PENDING')"
            ), {"id":payload.event_id, "fingerprint":recipient_hash, "kind":payload.kind})
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Email event already exists") from None

        result = "UNKNOWN"
        provider_id = None
        try:
            provider_id = _send_transactional_email(
                recipient_email=email, template=template, delivery_id=payload.event_id,
                tags=["kravia-public-access", payload.kind.lower()],
            )
            result = "DELIVERED"
        except (EmailDeliveryRejected, EmailDeliveryUnavailable):
            result = "FAILED"
        except EmailDeliveryUnknown:
            result = "UNKNOWN"
        finally:
            db.execute(text(
                "update office_public_access_email_deliveries"
                " set status=:status,provider_message_id=:provider_id,updated_at=CURRENT_TIMESTAMP"
                " where event_id=:id"
            ), {"status":result, "provider_id":provider_id, "id":payload.event_id})
            db.commit()
        if result != "DELIVERED":
            raise HTTPException(503, "Email delivery not confirmed")
        return {"accepted": True, "duplicate": False}

    return router
