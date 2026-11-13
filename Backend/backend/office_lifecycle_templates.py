"""Server-side, email-safe rendering for the 81 KRAVIA Office lifecycle messages.

The source of truth is EmailTemplates' checked-in React Email catalog and
copy. Its deterministic JSON is verified by `npm run check` in EmailTemplates.

Rendering NEVER enqueues, sends, selects a recipient or verifies an event.
Those decisions require separately approved, committed Office event evidence.
Existing one-time-password and recovery delivery must remain on its dedicated
security path and must never use this generic renderer.
"""
from __future__ import annotations

from functools import lru_cache
from html import escape
import json
from pathlib import Path
import re
from typing import Any
from urllib.parse import urlsplit, unquote

from .email_templates import TransactionalEmail

_MANIFEST = Path(__file__).with_name("generated_office_lifecycle_templates.json")
_ID = re.compile(r"^(AUTH|HIRE|ONB|ROLE|TIME|PAY|DEV|EXIT)-[0-9]{2}$")
_REFERENCE = re.compile(r"^[A-Za-z0-9_.:-]{5,120}$")
_TOKEN = re.compile(r"\{\{([a-z_]+)\}\}")
_CATEGORIES = {"AUTH": 12, "HIRE": 10, "ONB": 12, "ROLE": 9,
               "TIME": 10, "PAY": 12, "DEV": 8, "EXIT": 8}
_SITE = "https://www.kraviaprivatelimited.com"
_BRAND = _SITE + "/brand/kravia-header-lockup-v2.png"


class LifecycleEmailConfigurationError(RuntimeError):
    """Fail closed if the canonical 81-event artifact is missing or stale."""


def _safe_text(value: str, label: str, maximum: int = 160) -> str:
    if not isinstance(value, str):
        raise ValueError("Invalid Office lifecycle " + label)
    normalized = value.strip()
    if not normalized or len(normalized) > maximum or any(ord(c) < 32 or ord(c) == 127 for c in normalized):
        raise ValueError("Invalid Office lifecycle " + label)
    return normalized


def _private_url(value: str | None) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or len(value) > 400:
        raise ValueError("Invalid Office lifecycle URL")
    parts = urlsplit(value)
    decoded = unquote(parts.path)
    if (parts.scheme != "https" or parts.netloc != "www.kraviaprivatelimited.com"
            or not decoded.startswith("/office/")
            or any(segment in (".", "..") for segment in decoded.split("/"))
            or "\\" in decoded or parts.query or parts.fragment
            or "@" in value.split("/")[2] or parts.username or parts.password or parts.port):
        raise ValueError("Office lifecycle actions are restricted to the private Office origin")
    return value


@lru_cache(maxsize=1)
def lifecycle_catalog() -> dict[str, dict[str, str]]:
    try:
        raw: Any = json.loads(_MANIFEST.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise LifecycleEmailConfigurationError("Office lifecycle email artifact unavailable") from exc
    if (not isinstance(raw, dict) or raw.get("format") != 1
            or raw.get("total") != 81 or raw.get("dispatchEnabled") is not False
            or not isinstance(raw.get("templates"), dict)
            or len(raw["templates"]) != 81):
        raise LifecycleEmailConfigurationError("Office lifecycle manifest has an invalid release gate")
    parsed: dict[str, dict[str, str]] = {}
    counts = {key: 0 for key in _CATEGORIES}
    for event_id, entry in raw["templates"].items():
        if not isinstance(event_id, str) or not _ID.fullmatch(event_id) or not isinstance(entry, dict):
            raise LifecycleEmailConfigurationError("Office lifecycle event code is invalid")
        if entry.get("id") != event_id or entry.get("priority") not in ("P0", "P1", "P2") or entry.get("baseline") not in ("Existing", "New"):
            raise LifecycleEmailConfigurationError("Office lifecycle event definition is incomplete")
        required = ("subject", "body", "intent", "triggerProposal", "recipientProposal")
        if any(not isinstance(entry.get(key), str) or not entry[key].strip() for key in required):
            raise LifecycleEmailConfigurationError("Office lifecycle template copy is incomplete")
        if any("<script" in entry[key].lower() or "javascript:" in entry[key].lower() for key in ("subject", "body")):
            raise LifecycleEmailConfigurationError("Office lifecycle content contains executable markup")
        if len(entry["subject"]) > 180 or len(entry["body"]) > 2400:
            raise LifecycleEmailConfigurationError("Office lifecycle copy exceeds configured limit")
        tokens = set(_TOKEN.findall(entry["subject"]))
        if tokens - {"employee_first_name", "pay_period"}:
            raise LifecycleEmailConfigurationError("Office lifecycle subject contains unapproved tokens")
        if "{{" in _TOKEN.sub("", entry["subject"]) or "}}" in _TOKEN.sub("", entry["subject"]):
            raise LifecycleEmailConfigurationError("Office lifecycle subject has unresolved tokens")
        counts[event_id.split("-")[0]] += 1
        parsed[event_id] = {key: str(entry[key]) for key in required}
    if counts != _CATEGORIES:
        raise LifecycleEmailConfigurationError("Office lifecycle category counts do not match 81-event specification")
    return parsed


def render_office_lifecycle_notice(
    *, event_code: str, recipient_name: str, event_reference: str,
    pay_period: str | None = None, office_url: str | None = None,
) -> TransactionalEmail:
    """Deterministic, escaped HTML + plaintext; no send or event attestation."""
    item = lifecycle_catalog().get(event_code)
    if item is None:
        raise ValueError("Unknown Office lifecycle event")
    name = _safe_text(recipient_name, "recipient name")
    reference = _safe_text(event_reference, "event reference", 120)
    if not _REFERENCE.fullmatch(reference):
        raise ValueError("Office lifecycle reference must not contain sensitive or unsafe characters")
    tokens: dict[str, str] = {"employee_first_name": name.split()[0]}
    if "{{pay_period}}" in item["subject"]:
        tokens["pay_period"] = _safe_text(pay_period or "", "approved payroll period", 40)
    subject = _TOKEN.sub(lambda match: tokens[match.group(1)], item["subject"])
    if "{{" in subject or "}}" in subject or any(ord(c) < 32 for c in subject):
        raise ValueError("Office lifecycle subject is unresolved or unsafe")
    url = _private_url(office_url)
    brand = escape(_BRAND, quote=True)
    title = escape(subject)
    safe_name = escape(name)
    safe_body = escape(item["body"])
    safe_ref = escape(reference)
    action = (
        '<tr><td style="padding:8px 24px 20px"><a href="' + escape(url, quote=True)
        + '" style="display:inline-block;background-color:#174ea6;color:#ffffff;'
        'font:700 14px/22px Arial,sans-serif;padding:12px 18px;'
        'border-radius:8px;text-decoration:none">Review in private KRAVIA Office</a></td></tr>'
        if url else ""
    )
    html = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light">'
        '<meta name="supported-color-schemes" content="light">'
        '</head><body style="background-color:#f1f4f8;margin:0;padding:0;'
        'font-family:Arial,Helvetica,sans-serif;color:#142338">'
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"'
        ' style="background-color:#f1f4f8;width:100%"><tr><td align="center"'
        ' style="padding:25px 12px"><table role="presentation" width="600"'
        ' cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;'
        'background-color:#ffffff;border:1px solid #dae3ee">'
        '<tr><td align="center" style="background-color:#ffffff;padding:25px 22px;'
        'border-bottom:1px solid #dae3ee"><img alt="KRAVIA PRIVATE LIMITED"'
        ' width="218" src="' + brand + '"'
        ' style="display:block;max-width:100%;height:auto;background:#fff;border:0"></td></tr>'
        '<tr><td style="padding:26px 26px 10px">'
        '<p style="color:#174ea6;font:700 11px/18px Arial,sans-serif;'
        'letter-spacing:1px;margin:0 0 12px">KRAVIA OFFICE · ' + escape(event_code) + '</p>'
        '<h1 style="font:700 26px/34px Arial,sans-serif;color:#142338;margin:0 0 18px">'
        + title + '</h1>'
        '<p style="font:15px/23px Arial,sans-serif;margin:0 0 15px">Hello ' + safe_name + ',</p>'
        '<p style="font:14px/24px Arial,sans-serif;color:#485d73;margin:0 0 18px">'
        + safe_body + '</p></td></tr>'
        '<tr><td style="padding:10px 26px 20px"><table role="presentation" width="100%"'
        ' cellspacing="0" cellpadding="0" style="background:#f2f6fc;'
        'border-left:4px solid #174ea6"><tr><td style="padding:16px">'
        '<p style="font:700 11px/17px Arial,sans-serif;margin:0 0 7px">'
        'Office event reference</p><p style="font:13px/20px Consolas,monospace;'
        'overflow-wrap:anywhere;margin:0">' + safe_ref + '</p></td></tr></table></td></tr>'
        + action +
        '<tr><td style="padding:4px 26px 22px;color:#485d73;'
        'font:12px/20px Arial,sans-serif">'
        'This notice does not independently certify employment, permissions,'
        ' a signed document, or bank settlement. Sensitive records must be'
        ' reviewed through authorised private channels.</td></tr>'
        '<tr><td align="center" style="background:#172c48;color:#eff5fc;padding:22px">'
        '<p style="font:700 12px/20px Arial,sans-serif;margin:0 0 8px">'
        'KRAVIA PRIVATE LIMITED</p>'
        '<p style="font:11px/19px Arial,sans-serif;margin:0">'
        'Never share passwords, verification codes or banking information by email.'
        '</p></td></tr></table></td></tr></table></body></html>'
    )
    plaintext = "\n".join([
        subject, "", f"Hello {name},", "", item["body"], "",
        "Office event reference: " + reference,
        *(["", "Review in private Office: " + url] if url else []),
        "", "This notice does not certify salary payment, employment, access or signed records.",
        "KRAVIA PRIVATE LIMITED",
    ])
    return TransactionalEmail(subject=subject, html_content=html, text_content=plaintext)


def lifecycle_catalog_status() -> dict[str, object]:
    """Catalog readiness, never permission to send."""
    return {"events": len(lifecycle_catalog()), "dispatch_enabled": False, "categories": dict(_CATEGORIES)}
