"""Brevo-backed transactional delivery boundary for KRAVIA Office.

Only this module knows Brevo's HTTP contract. It is intentionally synchronous:
the identity endpoint must report a known delivery failure rather than queueing
an opaque background send that could leave a user waiting for a code.
"""
from __future__ import annotations

from dataclasses import dataclass
import os
import re

import httpx

from .email_templates import TransactionalEmail, kravia_welcome_template, office_email_verification_template, public_form_follow_up_template, public_form_receipt_template


BREVO_EMAIL_ENDPOINT = "https://api.brevo.com/v3/smtp/email"
KRAVIA_SENDER_EMAIL = "hello@kraviaprivatelimited.com"
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class EmailDeliveryUnavailable(RuntimeError):
    """The provider is intentionally unavailable before it has been configured."""


class EmailDeliveryRejected(RuntimeError):
    """Brevo definitively rejected a request before accepting it for delivery."""


class EmailDeliveryUnknown(RuntimeError):
    """A timeout or provider/server fault left the send outcome unknown."""


@dataclass(frozen=True)
class BrevoSettings:
    api_key: str
    sender_email: str
    sender_name: str
    timeout_seconds: float


def _settings() -> BrevoSettings:
    api_key = os.getenv("BREVO_API_KEY", "").strip()
    sender_email = os.getenv("BREVO_SENDER_EMAIL", KRAVIA_SENDER_EMAIL).strip().lower()
    sender_name = os.getenv("BREVO_SENDER_NAME", "KRAVIA").strip()
    timeout_seconds = float(os.getenv("BREVO_API_TIMEOUT_SECONDS", "10"))
    if not api_key:
        raise EmailDeliveryUnavailable("Email verification is not configured")
    if sender_email != KRAVIA_SENDER_EMAIL:
        raise EmailDeliveryUnavailable("KRAVIA email sender is not configured")
    if not sender_name or len(sender_name) > 120 or not EMAIL_PATTERN.fullmatch(sender_email):
        raise EmailDeliveryUnavailable("KRAVIA email sender is not configured")
    if not 1 <= timeout_seconds <= 30:
        raise EmailDeliveryUnavailable("KRAVIA email delivery timeout is invalid")
    return BrevoSettings(
        api_key=api_key,
        sender_email=sender_email,
        sender_name=sender_name,
        timeout_seconds=timeout_seconds,
    )


def _send_transactional_email(
    *,
    recipient_email: str,
    template: TransactionalEmail,
    delivery_id: str,
    tags: list[str],
) -> str | None:
    """Submit one server-rendered transactional email to Brevo.

    The API key, recipient content and provider response body are
    never logged. A timeout is deliberately classified as unknown rather than
    retried because Brevo may already have accepted the email.
    """
    settings = _settings()
    if not EMAIL_PATTERN.fullmatch(recipient_email):
        raise EmailDeliveryRejected("The recipient email address is invalid")
    payload = {
        "sender": {"name": settings.sender_name, "email": settings.sender_email},
        "to": [{"email": recipient_email}],
        "replyTo": {"email": settings.sender_email, "name": settings.sender_name},
        "subject": template.subject,
        "htmlContent": template.html_content,
        "textContent": template.text_content,
        "tags": tags,
        "headers": {"Idempotency-Key": delivery_id},
    }
    try:
        with httpx.Client(
            timeout=httpx.Timeout(settings.timeout_seconds),
            follow_redirects=False,
            trust_env=False,
        ) as client:
            response = client.post(
                BREVO_EMAIL_ENDPOINT,
                headers={
                    "accept": "application/json",
                    "api-key": settings.api_key,
                    "content-type": "application/json",
                },
                json=payload,
            )
    except (httpx.TimeoutException, httpx.NetworkError, httpx.ProtocolError) as exc:
        raise EmailDeliveryUnknown("The delivery provider did not confirm this email") from exc

    if response.status_code == 201:
        try:
            message_id = response.json().get("messageId")
        except ValueError:
            message_id = None
        return str(message_id)[:320] if isinstance(message_id, str) else None
    if 400 <= response.status_code < 500:
        raise EmailDeliveryRejected("The delivery provider rejected this email")
    raise EmailDeliveryUnknown("The delivery provider did not confirm this email")


def send_office_email_verification_code(
    *,
    recipient_email: str,
    code: str,
    expiry_minutes: int,
    delivery_id: str,
) -> str | None:
    return _send_transactional_email(
        recipient_email=recipient_email,
        template=office_email_verification_template(code=code, expiry_minutes=expiry_minutes),
        delivery_id=delivery_id,
        tags=["kravia-office-auth", "email-otp"],
    )


def send_public_form_receipt(
    *,
    recipient_email: str,
    recipient_name: str,
    form_kind: str,
    reference: str,
    delivery_id: str,
) -> str | None:
    """Deliver a public-form acknowledgement from the verified KRAVIA sender."""
    return _send_transactional_email(
        recipient_email=recipient_email,
        template=public_form_receipt_template(
            form_kind=form_kind,
            recipient_name=recipient_name,
            reference=reference,
        ),
        delivery_id=delivery_id,
        tags=["kravia-public-form", form_kind.lower()],
    )


def send_public_form_follow_up(
    *,
    recipient_email: str,
    recipient_name: str,
    form_kind: str,
    reference: str,
    message: str,
    delivery_id: str,
) -> str | None:
    """Deliver an authenticated Office review response to a public requester."""
    return _send_transactional_email(
        recipient_email=recipient_email,
        template=public_form_follow_up_template(
            form_kind=form_kind,
            recipient_name=recipient_name,
            reference=reference,
            message=message,
        ),
        delivery_id=delivery_id,
        tags=["kravia-public-follow-up", form_kind.lower()],
    )


def send_kravia_welcome_email(*, recipient_email: str, recipient_name: str, delivery_id: str) -> str | None:
    """Deliver the branded KRAVIA welcome template through the trusted backend only."""
    return _send_transactional_email(
        recipient_email=recipient_email,
        template=kravia_welcome_template(recipient_name=recipient_name),
        delivery_id=delivery_id,
        tags=["kravia-welcome"],
    )
