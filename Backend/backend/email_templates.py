"""Server-safe rendering for KRAVIA's deterministic email template manifest.

The canonical layouts live in ``EmailTemplates/`` as deterministic HTML templates.
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
    "public_account_code",
    "public_account_welcome",
    "public_resource_receipt",
    "public_newsletter_confirm",
    "public_newsletter_welcome",
    "public_newsletter_digest",
    "public_newsletter_unsubscribed",
    "public_account_security",
    "public_preferences_changed",
    "public_feedback_ack",
}


class EmailTemplateConfigurationError(RuntimeError):
    """The generated email artifact is absent or unsafe to use."""


@lru_cache(maxsize=1)
def _manifest() -> Mapping[str, Mapping[str, str]]:
    """Load and validate the build-time email artifact once per process."""
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
    """Replace only known email placeholders with safe literal values."""
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


KRAVIA_OFFICE_LOGIN_URL = "https://kraviaprivatelimited.com/office/login"
KRAVIA_OFFICE_AUTHENTICATOR_GUIDE_URL = "https://kraviaprivatelimited.com/office/authenticator"
KRAVIA_AUTHENTICATOR_GOOGLE_PLAY_URL = (
    "https://play.google.com/store/apps/details?id=com.kraviaprivatelimited.authenticator"
)
GOOGLE_PLAY_BADGE_IMAGE_URL = (
    "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
)


def _office_app_download_html() -> str:
    """Use Google's official unmodified badge with a text fallback for blocked images."""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="margin:22px 0;background:#f0f4fb;border:1px solid #d9e3f1;border-radius:12px">'
        '<tr><td style="padding:18px 20px">'
        '<p style="font:700 15px/23px Arial,sans-serif;color:#182339;margin:0 0 5px">'
        'Get KRAVIA Authenticator</p>'
        '<p style="font:13px/21px Arial,sans-serif;color:#515d70;margin:0 0 11px">'
        'For Android phones, install the official app from Google Play.</p>'
        f'<a href="{KRAVIA_AUTHENTICATOR_GOOGLE_PLAY_URL}" '
        'style="display:inline-block;text-decoration:none" target="_blank" rel="noopener noreferrer">'
        f'<img src="{GOOGLE_PLAY_BADGE_IMAGE_URL}" alt="Get it on Google Play" '
        'width="194" height="75" '
        'style="display:block;width:194px;max-width:100%;height:auto;border:0" /></a>'
        '<p style="font:12px/20px Arial,sans-serif;color:#515d70;margin:10px 0 0">'
        'If the badge is blocked, open '
        f'<a style="color:#1559ce;text-decoration:underline" href="{KRAVIA_AUTHENTICATOR_GOOGLE_PLAY_URL}">'
        'KRAVIA Authenticator on Google Play</a>.</p>'
        '<p style="font:12px/20px Arial,sans-serif;color:#515d70;margin:7px 0 0">'
        f'Activation instructions: <a href="{KRAVIA_OFFICE_AUTHENTICATOR_GUIDE_URL}" '
        'style="color:#1559ce;text-decoration:underline">KRAVIA Office setup guide</a>. '
        'Do not install APKs from unverified sources.</p>'
        '</td></tr></table>'
    )


def _office_app_download_text() -> str:
    return (
        "KRAVIA Authenticator for Android\n"
        f"Get it on Google Play: {KRAVIA_AUTHENTICATOR_GOOGLE_PLAY_URL}\n"
        f"Phone activation instructions: {KRAVIA_OFFICE_AUTHENTICATOR_GUIDE_URL}\n"
        "Never install APKs from unverified sources."
    )


def office_invitation_template(*, recipient_name: str, registration_url: str, expiry_hours: int) -> TransactionalEmail:
    """Private registration CTA plus official Authenticator download instructions."""
    name = recipient_name.strip() or "Colleague"
    if len(name) > 120:
        raise ValueError("Invalid invitation recipient")
    parsed = urlsplit(registration_url)
    if (parsed.scheme != "https" or parsed.hostname not in
            {"kraviaprivatelimited.com", "www.kraviaprivatelimited.com"}
            or parsed.username or parsed.password or parsed.path != "/office/register"
            or not parsed.query.startswith("invite=") or parsed.fragment):
        raise ValueError("Invalid Office invitation URL")
    if not 1 <= expiry_hours <= 168:
        raise ValueError("Invalid invitation expiry")
    safe_url = escape(registration_url, quote=True)
    safe_name = escape(name)
    html_content = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        '<body style="margin:0;background:#f3f5f8;color:#172235;font-family:Arial,sans-serif">'
        '<main style="max-width:560px;margin:26px auto;padding:30px;background:#fff;'
        'border:1px solid #d7dfea;border-radius:18px">'
        '<p style="font:700 11px/18px Arial,sans-serif;color:#1559ce;letter-spacing:1.3px">'
        'KRAVIA PRIVATE LIMITED</p>'
        '<h1 style="font:700 25px/33px Arial,sans-serif;color:#172235">'
        'Your Office invitation</h1>'
        f'<p style="font:15px/24px Arial,sans-serif">Hello {safe_name},</p>'
        '<p style="font:14px/24px Arial,sans-serif;color:#495467">'
        'You have been invited to KRAVIA Office. Use the secure invitation link '
        'to register and verify your identity. Your workspace stays locked until '
        'the Founder approves the assigned access.</p>'
        f'<a href="{safe_url}" style="display:inline-block;background:#1559ce;color:#fff;'
        'text-decoration:none;font:700 15px/22px Arial,sans-serif;padding:14px 22px;'
        'border-radius:10px">Accept Invitation</a>'
        f'<p style="font:13px/21px Arial,sans-serif;color:#515d70">'
        f'This single-use invitation expires in {expiry_hours} hours. '
        'If you did not expect it, ignore this email.</p>'
        '<p style="font:12px/19px Arial,sans-serif;color:#515d70;word-break:break-all">'
        'If the invitation button is blocked, paste this link into your browser: '
        f'<a href="{safe_url}" style="color:#1559ce">{safe_url}</a></p>'
        + _office_app_download_html()
        + '<p style="font:12px/19px Arial,sans-serif;color:#515d70">'
        'KRAVIA will never ask you to share your password or one-time codes.</p>'
        '</main></body></html>'
    )
    text_content = (
        f"Hello {name},\n\nYou have been invited to KRAVIA Office.\n"
        f"Accept Invitation: {registration_url}\n\n"
        f"This single-use invitation expires in {expiry_hours} hours.\n"
        "Your workspace remains locked until access approval.\n\n"
        f"{_office_app_download_text()}\n\n"
        "KRAVIA will never ask for your password or one-time code by email.\n"
        "If you did not expect this invitation, ignore this email."
    )
    return TransactionalEmail(
        subject="You are invited to KRAVIA Office",
        html_content=html_content,
        text_content=text_content,
    )



def office_password_recovery_template(*, recipient_name: str, recovery_url: str, expiry_minutes: int) -> TransactionalEmail:
    """Send only the registered Office account holder a private password-reset link."""
    name = recipient_name.strip() or "Colleague"
    if len(name) > 160:
        raise ValueError("Invalid recovery recipient")
    parsed = urlsplit(recovery_url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in {"kraviaprivatelimited.com", "www.kraviaprivatelimited.com"}
        or parsed.username or parsed.password or parsed.port is not None
        or parsed.path != "/office/reset-password"
        or not re.fullmatch(r"token=[A-Za-z0-9._~-]{64,4096}", parsed.query)
        or parsed.fragment
    ):
        raise ValueError("Invalid Office recovery URL")
    if not 1 <= expiry_minutes <= 10080:
        raise ValueError("Invalid recovery expiry")
    safe_url = escape(recovery_url, quote=True)
    safe_name = escape(name)
    html_content = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        '<body style="margin:0;background:#f3f5f8;color:#172235;font-family:Arial,sans-serif">'
        '<main style="max-width:560px;margin:26px auto;padding:30px;background:#fff;'
        'border:1px solid #d7dfea;border-radius:18px">'
        '<p style="font:700 11px/18px Arial,sans-serif;color:#1559ce;letter-spacing:1.3px">'
        'KRAVIA PRIVATE LIMITED</p>'
        '<h1 style="font:700 25px/33px Arial,sans-serif;color:#172235">'
        'Reset your Office password</h1>'
        f'<p style="font:15px/24px Arial,sans-serif">Hello {safe_name},</p>'
        '<p style="font:14px/24px Arial,sans-serif;color:#495467">'
        'An authorised Office access administrator requested a password reset for your account. '
        'Use this secure link to choose a new password. This does not grant new workspace permissions.</p>'
        f'<a href="{safe_url}" style="display:inline-block;background:#1559ce;color:#fff;'
        'text-decoration:none;font:700 15px/22px Arial,sans-serif;padding:14px 22px;'
        'border-radius:10px">Create a new password</a>'
        f'<p style="font:13px/21px Arial,sans-serif;color:#515d70">'
        f'This private link expires in {expiry_minutes} minutes and stops working after a successful reset. '
        'Other signed-in Office sessions were revoked when this link was issued.</p>'
        '<p style="font:12px/19px Arial,sans-serif;color:#515d70;word-break:break-all">'
        'If the button is blocked, paste this URL into your browser: '
        f'<a href="{safe_url}" style="color:#1559ce">{safe_url}</a></p>'
        '<p style="font:12px/19px Arial,sans-serif;color:#515d70">'
        'If you did not expect this request, contact your Office administrator. '
        'Never share this link, your password or a one-time code.</p>'
        '</main></body></html>'
    )
    text_content = (
        f"Hello {name},\n\n"
        "An authorised KRAVIA Office administrator requested a password reset for your account.\n"
        f"Create a new password: {recovery_url}\n\n"
        f"This link expires in {expiry_minutes} minutes and stops working after a successful reset.\n"
        "Other active Office sessions were revoked. No permissions were changed.\n"
        "If you did not expect this request, contact your Office administrator.\n"
        "Never share this link, your password or a one-time code."
    )
    return TransactionalEmail(
        subject="Reset your KRAVIA Office password",
        html_content=html_content,
        text_content=text_content,
    )


def office_workspace_ready_template(*, recipient_name: str) -> TransactionalEmail:
    """Sent once after Founder activation, not on page visits or existing accounts."""
    name = (recipient_name.strip() or "Colleague")[:160]
    safe_name = escape(name)
    html_content = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        '<body style="margin:0;background:#f3f5f8;color:#172235;font-family:Arial,sans-serif">'
        '<main style="max-width:560px;margin:26px auto;padding:30px;background:#fff;'
        'border:1px solid #d7dfea;border-radius:18px">'
        '<p style="font:700 11px/18px Arial,sans-serif;color:#1559ce;letter-spacing:1.3px">'
        'KRAVIA PRIVATE LIMITED</p>'
        '<h1 style="font:700 25px/33px Arial,sans-serif;color:#172235">'
        'Your Office workspace is ready</h1>'
        f'<p style="font:15px/24px Arial,sans-serif">Hello {safe_name},</p>'
        '<p style="font:14px/24px Arial,sans-serif;color:#495467">'
        'Your requested KRAVIA Office workspace access has been approved. '
        'You can sign in with your existing corporate credentials and complete '
        'multi-factor authentication to access your assigned work.</p>'
        f'<a href="{KRAVIA_OFFICE_LOGIN_URL}" style="display:inline-block;background:#1559ce;'
        'color:#fff;text-decoration:none;font:700 15px/22px Arial,sans-serif;'
        'padding:14px 22px;border-radius:10px">Open KRAVIA Office</a>'
        + _office_app_download_html()
        + '<p style="font:12px/19px Arial,sans-serif;color:#515d70">'
        'You do not need to create another account. If this approval was unexpected, '
        'contact your company administrator through the established Office channel.</p>'
        '</main></body></html>'
    )
    text_content = (
        f"Hello {name},\n\n"
        "Your KRAVIA Office workspace access has been approved.\n"
        "Sign in with your existing corporate credentials and complete MFA.\n"
        f"Open KRAVIA Office: {KRAVIA_OFFICE_LOGIN_URL}\n\n"
        f"{_office_app_download_text()}\n\n"
        "If this approval was unexpected, contact your company administrator."
    )
    return TransactionalEmail(
        subject="Your KRAVIA Office workspace is ready",
        html_content=html_content,
        text_content=text_content,
    )



EMPLOYEE_REFERENCE_CODE_PATTERN = re.compile(r"^KRV-E[0-9]{2}-[A-F0-9]{16}$")


def office_employee_id_issued_template(*, recipient_name: str, employee_reference: str) -> TransactionalEmail:
    """Private, immutable employee-reference notice after governed issuance.

    Called only for a committed, independently verified employee outbox event.
    Neither invitation acceptance nor an Office access role is proof of
    employment. No banking, salary or document contents are included.
    """
    name = recipient_name.strip() or "Colleague"
    if not 1 <= len(name) <= 160 or any(ord(ch) < 32 for ch in name):
        raise ValueError("Invalid employee notification recipient")
    if not EMPLOYEE_REFERENCE_CODE_PATTERN.fullmatch(employee_reference):
        raise ValueError("Invalid permanent employee reference")
    safe_name = escape(name)
    safe_reference = escape(employee_reference)
    url = KRAVIA_SITE_URL + "/office/my-role"
    html_content = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8"/>'
        '<meta name="viewport" content="width=device-width,initial-scale=1"/>'
        '<meta name="color-scheme" content="light"/>'
        '<meta name="supported-color-schemes" content="light"/>'
        '<title>KRAVIA employee reference</title></head>'
        '<body style="margin:0;padding:0;background-color:#f2f5fa;'
        'font-family:Arial,Helvetica,sans-serif;color:#142338">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'border="0" style="width:100%"><tr><td align="center" style="padding:24px 12px">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" '
        'style="max-width:600px;width:100%;background-color:#fff;border:1px solid #dae3ee">'
        '<tr><td align="center" style="padding:24px;background-color:#fff">'
        f'<img alt="KRAVIA PRIVATE LIMITED" width="210" height="71" '
        f'src="{KRAVIA_SITE_URL}/brand/kravia-header-lockup-v2.png" '
        'style="display:block;width:210px;max-width:100%;height:auto;'
        'background-color:#fff;border:0"/></td></tr>'
        '<tr><td style="padding:27px 28px;border-top:3px solid #174ea6">'
        '<p style="font-size:11px;line-height:18px;letter-spacing:1.2px;'
        'font-weight:700;color:#174ea6;margin:0 0 10px">KRAVIA OFFICE · EMPLOYEE RECORD</p>'
        '<h1 style="font-size:26px;line-height:34px;color:#142338;margin:0 0 18px">'
        'Your permanent employee reference is available</h1>'
        f'<p style="font-size:15px;line-height:25px;margin:0 0 18px">Hello {safe_name},</p>'
        '<p style="font-size:14px;line-height:23px;color:#485d73;margin:0 0 18px">'
        'An authorised reviewer has completed the independent checks required '
        'for issuance of your permanent employee-facing reference.</p>'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'border="0" style="background:#f0f5fc;border:1px solid #cddcf0;margin:0 0 18px">'
        '<tr><td style="padding:18px">'
        '<p style="font-size:10px;font-weight:700;letter-spacing:1px;'
        'color:#37567d;margin:0 0 8px">PERMANENT EMPLOYEE REFERENCE</p>'
        f'<p style="font-size:20px;line-height:27px;font-weight:700;letter-spacing:.5px;'
        f'color:#183f78;margin:0">{safe_reference}</p></td></tr></table>'
        '<p style="font-size:13px;line-height:23px;color:#485d73;margin:0 0 17px">'
        'This reference does not replace your canonical employment record '
        'or independently certify a statutory appointment, payroll payment or signed document.</p>'
        f'<a href="{url}" style="display:inline-block;padding:12px 20px;'
        'background-color:#174ea6;color:#fff;text-decoration:none;'
        'font-weight:700;font-size:14px;line-height:22px">'
        'View your private employee profile</a>'
        '</td></tr>'
        '<tr><td align="center" style="background-color:#172c48;'
        'padding:22px 24px;color:#eef5fc">'
        '<p style="font-size:12px;line-height:20px;font-weight:700;margin:0 0 8px">'
        'KRAVIA PRIVATE LIMITED</p>'
        '<p style="font-size:11px;line-height:19px;margin:0;color:#dce7f6">'
        'Private Office communication. Never share passwords, verification codes '
        'or banking credentials by email.</p>'
        '</td></tr></table></td></tr></table></body></html>'
    )
    text_content = (
        "KRAVIA PRIVATE LIMITED\n"
        "Your permanent employee reference is available\n\n"
        f"Hello {name},\n\n"
        "Your permanent employee-facing reference was issued following the required "
        "independent onboarding verification.\n"
        f"Employee reference: {employee_reference}\n\n"
        "View your private employee profile: " + url + "\n\n"
        "This notice does not establish a payroll payment, statutory appointment "
        "or independently verified signed document. Never share your credentials.\n"
        "KRAVIA PRIVATE LIMITED"
    )
    return TransactionalEmail(
        subject="Your permanent KRAVIA employee reference is available",
        html_content=html_content,
        text_content=text_content,
    )


def office_email_verification_template(*, code: str, expiry_minutes: int) -> TransactionalEmail:
    """Build a single-use sign-in code message from the email source."""
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



PUBLIC_ACCESS_MAIL_TYPES = {
    "ACCOUNT_CODE": ("public_account_code", "Your KRAVIA public access verification code"),
    "ACCOUNT_WELCOME": ("public_account_welcome", "Your KRAVIA resource account is ready"),
    "DOWNLOAD_RECEIPT": ("public_resource_receipt", "Your KRAVIA resource download"),
    "NEWSLETTER_CONFIRM": ("public_newsletter_confirm", "Confirm your KRAVIA newsletter subscription"),
    "NEWSLETTER_WELCOME": ("public_newsletter_welcome", "Your KRAVIA newsletter subscription is active"),
    "NEWSLETTER_DIGEST": ("public_newsletter_digest", "KRAVIA company and product updates"),
    "NEWSLETTER_UNSUBSCRIBED": ("public_newsletter_unsubscribed", "Your KRAVIA newsletter preference was saved"),
    "ACCOUNT_SECURITY": ("public_account_security", "Security notice for your KRAVIA public account"),
    "PREFERENCES_CHANGED": ("public_preferences_changed", "Your KRAVIA email preferences changed"),
    "FEEDBACK_ACK": ("public_feedback_ack", "KRAVIA has received your feedback"),
}


def public_access_mail_template(
    *,
    kind: str,
    recipient_name: str,
    code: str | None = None,
    action_url: str | None = None,
    resource_title: str | None = None,
    issue_subject: str | None = None,
    message: str | None = None,
    unsubscribe_url: str | None = None,
    reference: str | None = None,
    status: str | None = None,
) -> TransactionalEmail:
    """Known-purpose, escaped templates only; never accept arbitrary HTML."""
    entry = PUBLIC_ACCESS_MAIL_TYPES.get(kind)
    if entry is None:
        raise ValueError("Unsupported email kind")
    if kind == "ACCOUNT_CODE" and (code is None or not VERIFICATION_CODE_PATTERN.fullmatch(code)):
        raise ValueError("Invalid verification code")
    if kind in {"NEWSLETTER_CONFIRM", "NEWSLETTER_DIGEST"}:
        target = action_url if kind == "NEWSLETTER_CONFIRM" else unsubscribe_url
        parsed = urlsplit(target or "")
        prefix = "/newsletter/confirm" if kind == "NEWSLETTER_CONFIRM" else "/newsletter/unsubscribe"
        if parsed.scheme != "https" or parsed.netloc != "www.kraviaprivatelimited.com" or parsed.path != prefix or parsed.fragment:
            raise ValueError("Invalid newsletter action URL")
        if not re.fullmatch(r"token=[A-Za-z0-9_-]{40,100}", parsed.query):
            raise ValueError("Invalid newsletter action token")
    values = {
        "@@KRAVIA_NAME@@": _normalized_name(recipient_name),
        "@@KRAVIA_CODE@@": code or "",
        "@@KRAVIA_ACTION_URL@@": action_url or "",
        "@@KRAVIA_RESOURCE_TITLE@@": resource_title or "",
        "@@KRAVIA_ISSUE_SUBJECT@@": issue_subject or "",
        "@@KRAVIA_MESSAGE@@": message or "",
        "@@KRAVIA_UNSUBSCRIBE_URL@@": unsubscribe_url or "",
        "@@KRAVIA_REFERENCE@@": reference or "",
        "@@KRAVIA_STATUS@@": status or "",
    }
    for name in ("@@KRAVIA_RESOURCE_TITLE@@", "@@KRAVIA_ISSUE_SUBJECT@@", "@@KRAVIA_MESSAGE@@", "@@KRAVIA_REFERENCE@@", "@@KRAVIA_STATUS@@"):
        if len(values[name]) > 15000:
            raise ValueError("Email field is too long")
    template_name, subject = entry
    if kind == "NEWSLETTER_DIGEST":
        subject = issue_subject or subject
    if len(subject) > 180:
        raise ValueError("Email subject is too long")
    return _render(template_name=template_name, subject=subject, values=values,
                   multiline_html_tokens=frozenset({"@@KRAVIA_MESSAGE@@"}))
