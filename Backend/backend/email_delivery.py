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

from .email_templates import (
    TransactionalEmail,
    kravia_welcome_template,
    office_device_approval_template,
    office_email_verification_template,
    public_form_follow_up_template,
    public_form_receipt_template,
    public_intake_internal_notification_template,
)


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
    reply_to_email: str | None = None,
    reply_to_name: str | None = None,
) -> str | None:
    """Submit one server-rendered transactional email to Brevo.

    The API key, recipient content and provider response body are
    never logged. A timeout is deliberately classified as unknown rather than
    retried because Brevo may already have accepted the email.
    """
    settings = _settings()
    if not EMAIL_PATTERN.fullmatch(recipient_email):
        raise EmailDeliveryRejected("The recipient email address is invalid")
    reply_to = {"email": settings.sender_email, "name": settings.sender_name}
    if reply_to_email is not None:
        normalized_reply_to = reply_to_email.strip().lower()
        if not EMAIL_PATTERN.fullmatch(normalized_reply_to):
            raise EmailDeliveryRejected("The reply-to email address is invalid")
        normalized_reply_name = (reply_to_name or "").strip()
        if not 1 <= len(normalized_reply_name) <= 120:
            raise EmailDeliveryRejected("The reply-to name is invalid")
        reply_to = {"email": normalized_reply_to, "name": normalized_reply_name}
    payload = {
        "sender": {"name": settings.sender_name, "email": settings.sender_email},
        "to": [{"email": recipient_email}],
        "replyTo": reply_to,
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


def send_office_device_approval(
    *,
    recipient_email: str,
    device_label: str,
    source_address: str | None,
    review_url: str,
    delivery_id: str,
) -> str | None:
    """Ask only the affected account holder to decide a new browser request."""
    return _send_transactional_email(
        recipient_email=recipient_email,
        template=office_device_approval_template(
            device_label=device_label,
            source_address=source_address,
            review_url=review_url,
        ),
        delivery_id=delivery_id,
        tags=["kravia-office-auth", "device-approval"],
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


def send_public_intake_internal_notification(
    *,
    form_kind: str,
    sender_name: str,
    sender_email: str,
    reference: str,
    request_subject: str,
    organisation: str | None,
    delivery_id: str,
) -> str | None:
    """Place a minimal, replyable public-intake notification in hello@.

    The Office record remains the only location containing the full request.
    This keeps sensitive Trust or security descriptions out of a shared inbox.
    """
    return _send_transactional_email(
        recipient_email=KRAVIA_SENDER_EMAIL,
        reply_to_email=sender_email,
        reply_to_name=sender_name,
        template=public_intake_internal_notification_template(
            form_kind=form_kind,
            sender_name=sender_name,
            sender_email=sender_email,
            reference=reference,
            request_subject=request_subject,
            organisation=organisation,
        ),
        delivery_id=delivery_id,
        tags=["kravia-public-intake", "internal-notification", form_kind.lower()],
    )


def send_kravia_welcome_email(*, recipient_email: str, recipient_name: str, delivery_id: str) -> str | None:
    """Deliver the branded KRAVIA welcome template through the trusted backend only."""
    return _send_transactional_email(
        recipient_email=recipient_email,
        template=kravia_welcome_template(recipient_name=recipient_name),
        delivery_id=delivery_id,
        tags=["kravia-welcome"],
    )
