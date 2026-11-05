"""Purpose-specific public-access emails, sharing KRAVIA's verified corporate identity.

These render static, email-client compatible HTML and a plain-text fallback.
All externally sourced values are escaped; marketing issues require an explicit
unsubscribe URL and are not available through the transactional delivery route.
"""
from __future__ import annotations

from html import escape
import re
from urllib.parse import urlsplit

from .email_templates import TransactionalEmail, KRAVIA_SITE_URL

_SOCIAL = (
    ("LinkedIn", "linkedin-v2.png", "https://linkedin.com/company/kravia-private-limited"),
    ("X", "x.png", "https://x.com/KraviaOfficial"),
    ("Instagram", "instagram-v2.png", "https://www.instagram.com/kravia_private_limited/"),
    ("Facebook", "facebook.png", "https://www.facebook.com/profile.php?id=61595906774125"),
)

TEMPLATE_KINDS = frozenset({
    "ACCOUNT_CODE", "ACCOUNT_WELCOME", "NEWSLETTER_CONFIRM",
    "NEWSLETTER_WELCOME", "NEWSLETTER_UNSUBSCRIBED",
    "DOWNLOAD_RECEIPT", "ACCOUNT_SECURITY", "NEWSLETTER_ISSUE",
})
TRANSACTIONAL_KINDS = TEMPLATE_KINDS - {"NEWSLETTER_ISSUE"}
TITLES = {
    "ACCOUNT_CODE": ("Verify your email address", "ACCOUNT ACCESS", "#315E9B"),
    "ACCOUNT_WELCOME": ("Welcome to KRAVIA", "YOUR PUBLIC ACCOUNT", "#315E9B"),
    "NEWSLETTER_CONFIRM": ("Confirm your subscription", "YOUR CHOICE", "#22846A"),
    "NEWSLETTER_WELCOME": ("You're subscribed", "KRAVIA UPDATES", "#22846A"),
    "NEWSLETTER_UNSUBSCRIBED": ("Your preference is updated", "EMAIL PREFERENCES", "#6A7D91"),
    "DOWNLOAD_RECEIPT": ("Your download is ready", "RESOURCE LIBRARY", "#355E95"),
    "ACCOUNT_SECURITY": ("Account security notice", "ACCOUNT SECURITY", "#B34F39"),
    "NEWSLETTER_ISSUE": ("Latest from KRAVIA", "KRAVIA NEWSLETTER", "#193B5B"),
}
SUBJECTS = {
    "ACCOUNT_CODE": "Your KRAVIA public account verification code",
    "ACCOUNT_WELCOME": "Welcome to KRAVIA",
    "NEWSLETTER_CONFIRM": "Confirm your KRAVIA newsletter subscription",
    "NEWSLETTER_WELCOME": "You are subscribed to KRAVIA updates",
    "NEWSLETTER_UNSUBSCRIBED": "Your KRAVIA newsletter preference was updated",
    "DOWNLOAD_RECEIPT": "KRAVIA resource download confirmation",
    "ACCOUNT_SECURITY": "Security notice for your KRAVIA account",
    "NEWSLETTER_ISSUE": "KRAVIA | Company and product updates",
}


def _safe_url(url: str, purpose: str) -> str:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.netloc != "www.kraviaprivatelimited.com":
        raise ValueError("Email link must use the official KRAVIA domain")
    if parsed.username or parsed.password or parsed.fragment:
        raise ValueError("Email link is malformed")
    if purpose == "confirm" and parsed.path != "/newsletter/confirm":
        raise ValueError("Invalid newsletter confirmation path")
    if purpose == "unsubscribe" and parsed.path != "/newsletter/unsubscribe":
        raise ValueError("Invalid newsletter unsubscribe path")
    return escape(url, quote=True)


def render_public_access_email(
    *, kind: str, recipient_name: str, code: str | None = None,
    action_url: str | None = None, resource_title: str | None = None,
    message: str | None = None,
) -> TransactionalEmail:
    if kind not in TEMPLATE_KINDS:
        raise ValueError("Unknown KRAVIA email kind")
    name = recipient_name.strip()
    if not 2 <= len(name) <= 120:
        raise ValueError("Invalid recipient name")
    safe_name = escape(name)
    title, label, accent = TITLES[kind]
    intro = f"Hello {safe_name},"
    intro_text = f"Hello {name},"
    content = ""
    text = ""
    if kind == "ACCOUNT_CODE":
        if not code or not re.fullmatch(r"\d{6}", code):
            raise ValueError("Invalid verification code")
        content = (
            '<p>Enter this code to confirm your email address. It expires in 10 minutes.</p>'
            f'<div style="padding:22px;background:#edf4ff;text-align:center;border:1px solid #cfdef0">'
            f'<div style="font-size:34px;font-weight:bold;letter-spacing:7px;color:#173b64">{code}</div>'
            '<div style="font-size:12px;color:#46688c">ONE-TIME VERIFICATION CODE · SINGLE USE</div></div>'
            '<p>If you did not initiate this request, you can ignore it. Never share this code.</p>'
        )
        text = f"Your one-time verification code is {code}. It expires in 10 minutes. Do not share it."
    elif kind == "ACCOUNT_WELCOME":
        content = '<p>Your public KRAVIA account is ready. You can view approved resources and manage your optional email preferences.</p><p>Company employee access remains separate from this public account.</p>'
        text = "Your KRAVIA public account is ready. You can now view approved resources and manage your email preferences."
    elif kind == "NEWSLETTER_CONFIRM":
        if not action_url: raise ValueError("Confirmation URL required")
        url = _safe_url(action_url, "confirm")
        content = (
            '<p>You requested optional KRAVIA company and product updates. '
            'Please confirm that choice using the button below.</p>'
            f'<p><a href="{url}" style="display:inline-block;background:#22846a;color:white;'
            'text-decoration:none;padding:13px 22px;font-weight:bold">Confirm subscription</a></p>'
            '<p>If you did not request these updates, do not confirm. No newsletter will be sent.</p>'
        )
        text = f"You requested optional KRAVIA updates. Confirm here: {action_url}. Ignore if not requested."
    elif kind == "NEWSLETTER_WELCOME":
        content = '<p>Your optional subscription has been confirmed. We will share relevant, approved company and product updates.</p><p>You can unsubscribe at any time from your account preferences or the link included in each newsletter.</p>'
        text = "Your KRAVIA newsletter subscription is confirmed. You can unsubscribe at any time in your account or from any newsletter."
    elif kind == "NEWSLETTER_UNSUBSCRIBED":
        content = '<p>Your newsletter preference was updated. You will no longer receive optional company and product updates.</p><p>Necessary account or security messages are unaffected.</p>'
        text = "You are unsubscribed from optional KRAVIA newsletters. Essential account and security notices are unaffected."
    elif kind == "DOWNLOAD_RECEIPT":
        if not resource_title or not 3 <= len(resource_title.strip()) <= 160:
            raise ValueError("Invalid resource title")
        content = f'<p>You accessed this approved KRAVIA resource:</p><p style="font-weight:bold">{escape(resource_title.strip())}</p><p>Sign in to review your download history. This is a transactional message, not a newsletter subscription.</p>'
        text = f"You downloaded {resource_title.strip()} from KRAVIA. This receipt does not subscribe you to newsletters."
    elif kind == "ACCOUNT_SECURITY":
        if not message or not 10 <= len(message.strip()) <= 500:
            raise ValueError("Invalid security notice")
        content = f'<p>{escape(message.strip())}</p><p>If you did not make this change, contact KRAVIA through the official website.</p>'
        text = f"{message.strip()}\nIf this wasn't you, contact KRAVIA using the official website."
    else:
        if not message or not 20 <= len(message.strip()) <= 5000 or not action_url:
            raise ValueError("Newsletter content and unsubscribe URL required")
        url = _safe_url(action_url, "unsubscribe")
        content = f'<p>{escape(message.strip())}</p><p><a href="{url}">Unsubscribe from KRAVIA updates</a></p>'
        text = f"{message.strip()}\nUnsubscribe: {action_url}"

    social_html = "".join(
        '<td width="25%" align="center" style="padding:3px;text-align:center">'
        f'<a href="{escape(href, quote=True)}" style="text-decoration:none;color:#D4E3F2">'
        f'<img src="{KRAVIA_SITE_URL}/brand/email/{icon}" alt="{label}" '
        'width="36" height="36" style="display:block;margin:auto;width:36px;height:36px;border:0" />'
        f'<span style="font-size:11px;line-height:21px">{label}</span></a></td>'
        for label, icon, href in _SOCIAL
    )
    footer = (
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>{social_html}</tr></table>'
        '<p style="font-size:11px;line-height:18px;margin:18px 0 0;color:#C6D9E9">'
        f'<a href="{KRAVIA_SITE_URL}/legal/privacy" style="color:#fff">Privacy</a> · '
        f'<a href="{KRAVIA_SITE_URL}/legal" style="color:#fff">Legal</a> · '
        f'<a href="{KRAVIA_SITE_URL}/contact" style="color:#fff">Contact</a></p>'
        '<p style="font-size:11px;color:#B9D0E5">© KRAVIA PRIVATE LIMITED. All rights reserved.</p>'
    )
    html = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="color-scheme" content="light dark"></head>'
        '<body style="margin:0;background:#e9eef4;font-family:Arial,Helvetica,sans-serif">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 12px">'
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#fff">'
        f'<tr><td style="padding:24px 30px;background:#f7fafc;border-top:4px solid {accent}">'
        f'<img alt="KRAVIA PRIVATE LIMITED" src="{KRAVIA_SITE_URL}/brand/kravia-header-lockup-v2.png" '
        'width="163" height="55" style="display:block;width:163px;height:55px;border:0"></td></tr>'
        f'<tr><td style="padding:24px 30px 8px;background:#fff">'
        f'<p style="margin:0 0 10px;color:{accent};font:bold 10px/18px Arial;letter-spacing:1.6px">{label}</p>'
        f'<h1 style="font:normal 30px/38px Georgia,serif;color:#172b3f;margin:0 0 20px">{title}</h1>'
        f'<div style="font-size:15px;line-height:26px;color:#24374a"><p>{intro}</p>{content}</div>'
        '</td></tr><tr><td style="background:#152d45;color:#fff;padding:24px 28px">'
        '<p style="font:bold 10px/16px Arial;color:#C6D9E9;letter-spacing:1.5px">CONNECT WITH KRAVIA</p>'
        f'{footer}</td></tr></table></td></tr></table></body></html>'
    )
    social_text = " · ".join(f"{label} {href}" for label, _, href in _SOCIAL)
    plaintext = (
        f"KRAVIA PRIVATE LIMITED\n{label}\n{title}\n\n{intro_text}\n\n{text}\n\n"
        f"CONNECT WITH KRAVIA\n{social_text}\n\n"
        f"Privacy {KRAVIA_SITE_URL}/legal/privacy · Contact {KRAVIA_SITE_URL}/contact\n"
        "© KRAVIA PRIVATE LIMITED. All rights reserved."
    )
    return TransactionalEmail(subject=SUBJECTS[kind], html_content=html, text_content=plaintext)
