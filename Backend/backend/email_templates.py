"""Server-safe rendering for KRAVIA's React Email template manifest.

The canonical layout lives in ``EmailTemplates/`` as React Email components.
Its checked-in, deterministic manifest is bundled with FastAPI so delivery does
not depend on a Node process in production. Runtime data is validated and
escaped here; no caller can supply arbitrary HTML to a customer email.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from html import escape
import json
from pathlib import Path
import re
from typing import Mapping
from urllib.parse import urlsplit


@dataclass(frozen=True)
class TransactionalEmail:
    subject: str
    html_content: str
    text_content: str


PUBLIC_FORM_COPY = {
    "CONTACT": ("contact request", "Our team will review your message and respond using the details you supplied."),
    "SUPPORT": ("support case", "Keep your case reference and the tracking code shown on the website if you need to check progress."),
    "TRUST_REQUEST": ("privacy or Trust request", "This request is routed through KRAVIA's restricted review process."),
}
PUBLIC_REFERENCE_PATTERN = re.compile(r"^KRV(?:-[A-F0-9]{24}|-SUP-[A-Z0-9]{8})$")
VERIFICATION_CODE_PATTERN = re.compile(r"^\d{6}$")
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
PLACEHOLDER_PATTERN = re.compile(r"@@KRAVIA_[A-Z_]+@@")
KRAVIA_SITE_URL = "https://www.kraviaprivatelimited.com"
_MANIFEST_PATH = Path(__file__).with_name("generated_email_templates.json")
_TEMPLATE_NAMES = {
    "office_sign_in_code",
    "office_device_approval",
    "public_request_received",
    "public_request_update",
    "public_intake_internal_notification",
    "public_welcome",
}


class EmailTemplateConfigurationError(RuntimeError):
    """The generated React Email artifact is absent or unsafe to use."""


@lru_cache(maxsize=1)
def _manifest() -> Mapping[str, Mapping[str, str]]:
    """Load and validate the build-time React Email artifact once per process."""
    try:
        raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EmailTemplateConfigurationError("KRAVIA email templates are unavailable") from exc
    if not isinstance(raw, dict) or raw.get("format") != 1 or not isinstance(raw.get("templates"), dict):
        raise EmailTemplateConfigurationError("KRAVIA email template manifest is invalid")

    templates: dict[str, Mapping[str, str]] = {}
    for name in _TEMPLATE_NAMES:
        candidate = raw["templates"].get(name)
        if not isinstance(candidate, dict):
            raise EmailTemplateConfigurationError("KRAVIA email template manifest is incomplete")
        html_content = candidate.get("html")
        text_content = candidate.get("text")
        if not isinstance(html_content, str) or not isinstance(text_content, str):
            raise EmailTemplateConfigurationError("KRAVIA email template manifest is invalid")
        if "<script" in html_content.lower() or "javascript:" in html_content.lower():
            raise EmailTemplateConfigurationError("KRAVIA email template manifest is unsafe")
        templates[name] = {"html": html_content, "text": text_content}
    return templates


def _normalized_name(value: str) -> str:
    name = value.strip()
    if not 2 <= len(name) <= 120:
        raise ValueError("Invalid recipient name")
    return name


def _valid_reference(value: str) -> str:
    if not PUBLIC_REFERENCE_PATTERN.fullmatch(value):
        raise ValueError("Invalid public request reference")
    return value


def _render(
    *,
    template_name: str,
    subject: str,
    values: Mapping[str, str],
    multiline_html_tokens: frozenset[str] = frozenset(),
) -> TransactionalEmail:
    """Replace only known React Email placeholders with safe literal values."""
    template = _manifest().get(template_name)
    if template is None:
        raise EmailTemplateConfigurationError("KRAVIA email template is unavailable")

    html_content = template["html"]
    text_content = template["text"]
    for token, value in values.items():
        if not PLACEHOLDER_PATTERN.fullmatch(token):
            raise EmailTemplateConfigurationError("KRAVIA email template placeholder is invalid")
        html_value = escape(value).replace("\n", "<br>\n") if token in multiline_html_tokens else escape(value)
        html_content = html_content.replace(token, html_value)
        text_content = text_content.replace(token, value)

    unresolved = PLACEHOLDER_PATTERN.search(html_content) or PLACEHOLDER_PATTERN.search(text_content)
    if unresolved:
        raise EmailTemplateConfigurationError("KRAVIA email template has unresolved placeholders")
    return TransactionalEmail(subject=subject, html_content=html_content, text_content=text_content)


def office_email_verification_template(*, code: str, expiry_minutes: int) -> TransactionalEmail:
    """Build a single-use sign-in code message from the React Email source."""
    if not VERIFICATION_CODE_PATTERN.fullmatch(code):
        raise ValueError("Invalid verification code")
    if not 1 <= expiry_minutes <= 60:
        raise ValueError("Invalid verification-code expiry")
    return _render(
        template_name="office_sign_in_code",
        subject=f"{code} is your KRAVIA verification code",
        values={
            "@@KRAVIA_CODE@@": code,
            "@@KRAVIA_EXPIRY_MINUTES@@": str(expiry_minutes),
        },
    )


def office_device_approval_template(
    *,
    device_label: str,
    source_address: str | None,
    review_url: str,
) -> TransactionalEmail:
    """Render an owner review link without allowing an email GET to decide."""
    label = device_label.strip()
    if not 2 <= len(label) <= 160:
        raise ValueError("Invalid device label")
    address = (source_address or "Unavailable").strip()
    if not 1 <= len(address) <= 64:
        raise ValueError("Invalid source address")
    parsed = urlsplit(review_url)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("Invalid device approval URL")
    return _render(
        template_name="office_device_approval",
        subject="Review a new KRAVIA Office device sign-in",
        values={
            "@@KRAVIA_DEVICE_LABEL@@": label,
            "@@KRAVIA_SOURCE_ADDRESS@@": address,
            "@@KRAVIA_REVIEW_URL@@": review_url,
        },
    )


def public_form_receipt_template(*, form_kind: str, recipient_name: str, reference: str) -> TransactionalEmail:
    """Render a public-form acknowledgement without echoing request content."""
    if form_kind not in PUBLIC_FORM_COPY:
        raise ValueError("Unsupported public form kind")
    name = _normalized_name(recipient_name)
    safe_reference = _valid_reference(reference)
    label, next_step = PUBLIC_FORM_COPY[form_kind]
    return _render(
        template_name="public_request_received",
        subject=f"We received your KRAVIA {label}",
        values={
            "@@KRAVIA_NAME@@": name,
            "@@KRAVIA_REFERENCE@@": safe_reference,
            "@@KRAVIA_REQUEST_KIND@@": label,
            "@@KRAVIA_NEXT_STEP@@": next_step,
        },
    )


def public_form_follow_up_template(*, form_kind: str, recipient_name: str, reference: str, message: str) -> TransactionalEmail:
    """Render one authenticated Office response as escaped plain-text content."""
    if form_kind not in PUBLIC_FORM_COPY:
        raise ValueError("Unsupported public form kind")
    name = _normalized_name(recipient_name)
    safe_reference = _valid_reference(reference)
    normalized_message = message.strip()
    if not 1 <= len(normalized_message) <= 5000:
        raise ValueError("Invalid follow-up message")
    label, _ = PUBLIC_FORM_COPY[form_kind]
    return _render(
        template_name="public_request_update",
        subject=f"Update on your KRAVIA {label} · {safe_reference}",
        values={
            "@@KRAVIA_NAME@@": name,
            "@@KRAVIA_REFERENCE@@": safe_reference,
            "@@KRAVIA_MESSAGE@@": normalized_message,
        },
        multiline_html_tokens=frozenset({"@@KRAVIA_MESSAGE@@"}),
    )


def public_intake_internal_notification_template(
    *,
    form_kind: str,
    sender_name: str,
    sender_email: str,
    reference: str,
    request_subject: str,
    organisation: str | None,
) -> TransactionalEmail:
    """Render the metadata-only internal notification for a public request.

    The original request remains in the access-controlled Office intake queue.
    This operational email deliberately contains only the reply identity and
    routing metadata so Trust and security submissions are not duplicated into
    a general mailbox.
    """
    if form_kind not in PUBLIC_FORM_COPY:
        raise ValueError("Unsupported public form kind")
    name = _normalized_name(sender_name)
    email = sender_email.strip().lower()
    if not EMAIL_PATTERN.fullmatch(email):
        raise ValueError("Invalid sender email")
    safe_reference = _valid_reference(reference)
    subject = request_subject.strip()
    if not 1 <= len(subject) <= 180:
        raise ValueError("Invalid public request subject")
    organization = (organisation or "").strip() or "Not provided"
    if len(organization) > 160:
        raise ValueError("Invalid public request organisation")
    label, _ = PUBLIC_FORM_COPY[form_kind]
    return _render(
        template_name="public_intake_internal_notification",
        subject=f"New KRAVIA {label} · {safe_reference}",
        values={
            "@@KRAVIA_NAME@@": name,
            "@@KRAVIA_SENDER_EMAIL@@": email,
            "@@KRAVIA_REFERENCE@@": safe_reference,
            "@@KRAVIA_REQUEST_KIND@@": label,
            "@@KRAVIA_REQUEST_SUBJECT@@": subject,
            "@@KRAVIA_ORGANISATION@@": organization,
        },
    )


def kravia_welcome_template(*, recipient_name: str) -> TransactionalEmail:
    """Render a truthful welcome email without implying a form submission."""
    return _render(
        template_name="public_welcome",
        subject="Welcome to KRAVIA",
        values={"@@KRAVIA_NAME@@": _normalized_name(recipient_name)},
    )
