"""Signed public-form acknowledgement delivery for the KRAVIA website.

The public Next.js site owns public-form persistence. This API accepts only a
short-lived HMAC-authenticated server-to-server event and sends the receipt
through the same verified Brevo sender used by other KRAVIA transactional mail.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import os
import re
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth_models import OfficePublicEmailDelivery
from .email_delivery import (
    EmailDeliveryRejected,
    EmailDeliveryUnavailable,
    EmailDeliveryUnknown,
    send_public_form_follow_up as deliver_public_form_follow_up,
    send_public_form_receipt as deliver_public_form_receipt,
)


PUBLIC_INTAKE_SIGNATURE_HEADER = "x-kravia-intake-signature"
PUBLIC_INTAKE_TIMESTAMP_HEADER = "x-kravia-intake-timestamp"
PUBLIC_INTAKE_SIGNATURE_TTL_SECONDS = 300
EVENT_ID_PATTERN = re.compile(r"^[A-Za-z0-9:_-]{12,160}$")
REFERENCE_PATTERN = re.compile(r"^KRV(?:-[A-F0-9]{24}|-SUP-[A-Z0-9]{8})$")
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
MAX_SIGNED_BODY_BYTES = 8192


class PublicFormReceiptPayload(BaseModel):
    event_id: str = Field(min_length=12, max_length=160)
    form_kind: str = Field(min_length=3, max_length=32)
    reference: str = Field(min_length=12, max_length=64)
    recipient_email: str = Field(min_length=3, max_length=254)
    recipient_name: str = Field(min_length=2, max_length=120)

    @field_validator("event_id")
    @classmethod
    def valid_event_id(cls, value: str) -> str:
        if not EVENT_ID_PATTERN.fullmatch(value):
            raise ValueError("Invalid delivery event")
        return value

    @field_validator("form_kind")
    @classmethod
    def valid_form_kind(cls, value: str) -> str:
        if value not in {"CONTACT", "SUPPORT", "TRUST_REQUEST"}:
            raise ValueError("Invalid public form kind")
        return value

    @field_validator("reference")
    @classmethod
    def valid_reference(cls, value: str) -> str:
        if not REFERENCE_PATTERN.fullmatch(value):
            raise ValueError("Invalid public request reference")
        return value

    @field_validator("recipient_email")
    @classmethod
    def valid_recipient_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("Invalid recipient")
        return normalized

    @field_validator("recipient_name")
    @classmethod
    def valid_recipient_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Invalid recipient")
        return normalized


class PublicFormFollowUpPayload(PublicFormReceiptPayload):
    message: str = Field(min_length=1, max_length=5000)

    @field_validator("message")
    @classmethod
    def valid_message(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Invalid follow-up message")
        return normalized


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _notification_secret() -> str:
    secret = os.getenv("KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET", "").strip()
    if len(secret) < 32:
        raise HTTPException(status_code=503, detail="Public email acknowledgement is not configured")
    return secret


def _signature(secret: str, timestamp: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), timestamp.encode("ascii") + b"." + body, hashlib.sha256).hexdigest()


def _recipient_fingerprint(secret: str, recipient_email: str) -> str:
    return hmac.new(secret.encode("utf-8"), f"recipient:{recipient_email}".encode("utf-8"), hashlib.sha256).hexdigest()


def _content_fingerprint(secret: str, message: str) -> str:
    return hmac.new(secret.encode("utf-8"), f"content:{message}".encode("utf-8"), hashlib.sha256).hexdigest()


def _verify_signature(request: Request, body: bytes, secret: str) -> None:
    if len(body) > MAX_SIGNED_BODY_BYTES:
        raise HTTPException(status_code=413, detail="Public email delivery request is too large")
    timestamp = request.headers.get(PUBLIC_INTAKE_TIMESTAMP_HEADER, "").strip()
    supplied = request.headers.get(PUBLIC_INTAKE_SIGNATURE_HEADER, "").strip()
    if not timestamp.isdecimal() or not supplied.startswith("v1="):
        raise HTTPException(status_code=401, detail="Public email acknowledgement is not authorised")
    if abs(time.time() - int(timestamp)) > PUBLIC_INTAKE_SIGNATURE_TTL_SECONDS:
        raise HTTPException(status_code=401, detail="Public email acknowledgement has expired")
    if not hmac.compare_digest(supplied[3:], _signature(secret, timestamp, body)):
        raise HTTPException(status_code=401, detail="Public email acknowledgement is not authorised")


def _existing_delivery_response(
    existing: OfficePublicEmailDelivery,
    payload: PublicFormReceiptPayload,
    fingerprint: str,
    *,
    delivery_kind: str,
    content_fingerprint: str | None = None,
) -> dict[str, str]:
    if (
        not hmac.compare_digest(existing.recipient_fingerprint, fingerprint)
        or existing.reference != payload.reference
        or existing.form_kind != payload.form_kind
        or existing.delivery_kind != delivery_kind
        or (content_fingerprint is not None and not hmac.compare_digest(existing.content_fingerprint or "", content_fingerprint))
    ):
        raise HTTPException(status_code=409, detail="Public email delivery event conflicts with an existing request")
    if existing.status == "SENT":
        return {"delivery": "already_sent"}
    if existing.status == "PENDING":
        raise HTTPException(status_code=409, detail="Public email acknowledgement is already being processed")
    raise HTTPException(status_code=503, detail="Public email delivery could not be confirmed", headers={"x-kravia-delivery-status": existing.status})


def build_public_intake_email_router(get_db) -> APIRouter:
    router = APIRouter(prefix="/api/v1/public-intake", tags=["public-intake"])

    @router.post("/email-acknowledgements", status_code=201)
    async def send_public_form_receipt(request: Request, db: Session = Depends(get_db)):
        secret = _notification_secret()
        body = await request.body()
        _verify_signature(request, body, secret)
        try:
            payload = PublicFormReceiptPayload.model_validate_json(body)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid public email acknowledgement") from exc

        fingerprint = _recipient_fingerprint(secret, payload.recipient_email)
        existing = db.get(OfficePublicEmailDelivery, payload.event_id)
        if existing:
            return _existing_delivery_response(existing, payload, fingerprint, delivery_kind="ACKNOWLEDGEMENT")

        delivery = OfficePublicEmailDelivery(
            event_id=payload.event_id,
            reference=payload.reference,
            form_kind=payload.form_kind,
            delivery_kind="ACKNOWLEDGEMENT",
            recipient_fingerprint=fingerprint,
            status="PENDING",
        )
        db.add(delivery)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.get(OfficePublicEmailDelivery, payload.event_id)
            if existing:
                return _existing_delivery_response(existing, payload, fingerprint, delivery_kind="ACKNOWLEDGEMENT")
            raise HTTPException(status_code=503, detail="Public email acknowledgement is temporarily unavailable")

        try:
            message_id = deliver_public_form_receipt(
                recipient_email=payload.recipient_email,
                recipient_name=payload.recipient_name,
                form_kind=payload.form_kind,
                reference=payload.reference,
                delivery_id=payload.event_id,
            )
        except (EmailDeliveryUnavailable, EmailDeliveryRejected):
            delivery.status = "DELIVERY_FAILED"
            delivery.failed_at = _now()
            db.commit()
            raise HTTPException(status_code=503, detail="Public email acknowledgement is temporarily unavailable", headers={"x-kravia-delivery-status": "FAILED"})
        except EmailDeliveryUnknown:
            delivery.status = "DELIVERY_UNKNOWN"
            delivery.failed_at = _now()
            db.commit()
            raise HTTPException(status_code=503, detail="Public email acknowledgement could not be confirmed", headers={"x-kravia-delivery-status": "UNKNOWN"})

        delivery.status = "SENT"
        delivery.provider_message_id = message_id
        delivery.delivered_at = _now()
        db.commit()
        return {"delivery": "sent"}

    @router.post("/email-follow-ups", status_code=201)
    async def send_public_form_follow_up(request: Request, db: Session = Depends(get_db)):
        """Deliver one persisted, Office-authored public-request follow-up.

        The browser never calls this route. The Next.js Office BFF signs a
        short-lived request only after it records the note in the canonical
        public-intake database. Unknown outcomes stay terminal to prevent
        duplicate customer mail.
        """
        secret = _notification_secret()
        body = await request.body()
        _verify_signature(request, body, secret)
        try:
            payload = PublicFormFollowUpPayload.model_validate_json(body)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid public email follow-up") from exc

        recipient_fingerprint = _recipient_fingerprint(secret, payload.recipient_email)
        content_fingerprint = _content_fingerprint(secret, payload.message)
        existing = db.get(OfficePublicEmailDelivery, payload.event_id)
        if existing:
            return _existing_delivery_response(
                existing,
                payload,
                recipient_fingerprint,
                delivery_kind="FOLLOW_UP",
                content_fingerprint=content_fingerprint,
            )

        delivery = OfficePublicEmailDelivery(
            event_id=payload.event_id,
            reference=payload.reference,
            form_kind=payload.form_kind,
            delivery_kind="FOLLOW_UP",
            content_fingerprint=content_fingerprint,
            recipient_fingerprint=recipient_fingerprint,
            status="PENDING",
        )
        db.add(delivery)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = db.get(OfficePublicEmailDelivery, payload.event_id)
            if existing:
                return _existing_delivery_response(
                    existing,
                    payload,
                    recipient_fingerprint,
                    delivery_kind="FOLLOW_UP",
                    content_fingerprint=content_fingerprint,
                )
            raise HTTPException(status_code=503, detail="Public email follow-up is temporarily unavailable")

        try:
            message_id = deliver_public_form_follow_up(
                recipient_email=payload.recipient_email,
                recipient_name=payload.recipient_name,
                form_kind=payload.form_kind,
                reference=payload.reference,
                message=payload.message,
                delivery_id=payload.event_id,
            )
        except (EmailDeliveryUnavailable, EmailDeliveryRejected):
            delivery.status = "DELIVERY_FAILED"
            delivery.failed_at = _now()
            db.commit()
            raise HTTPException(status_code=503, detail="Public email follow-up is temporarily unavailable", headers={"x-kravia-delivery-status": "FAILED"})
        except EmailDeliveryUnknown:
            delivery.status = "DELIVERY_UNKNOWN"
            delivery.failed_at = _now()
            db.commit()
            raise HTTPException(status_code=503, detail="Public email follow-up could not be confirmed", headers={"x-kravia-delivery-status": "UNKNOWN"})

        delivery.status = "SENT"
        delivery.provider_message_id = message_id
        delivery.delivered_at = _now()
        db.commit()
        return {"delivery": "sent"}

    return router
