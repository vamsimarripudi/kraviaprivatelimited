"""Safe, deliberately link-free candidate notices for opted-in hiring workflows.

No employee Office URLs, private documents, salary, verification tokens or
recruitment-review notes are copied into external email. Candidate contact is
independently verified and authorised at the SQL claim boundary.
"""
from __future__ import annotations

from html import escape

from .email_templates import TransactionalEmail

_NOTICES = {
    "HIRE-01": ("KRAVIA has recorded your application", "Your application has been recorded in KRAVIA's hiring system."),
    "HIRE-02": ("Your KRAVIA interview has been scheduled", "Your interview has been scheduled by the KRAVIA hiring team."),
    "HIRE-03": ("Your KRAVIA interview time has changed", "The hiring team has recorded a revised interview schedule."),
    "HIRE-04": ("Your KRAVIA interview was cancelled", "The planned interview was cancelled by the hiring team."),
    "HIRE-05": ("KRAVIA candidate documents requested", "The hiring team has recorded a document request for your application."),
    "HIRE-06": ("KRAVIA candidate document needs attention", "A candidate document requires correction or a further review."),
    "HIRE-08": ("Your KRAVIA offer document was released", "The approved offer document has been marked delivered in the protected document system."),
    "HIRE-09": ("KRAVIA has recorded your offer acceptance", "Your offer acceptance has been recorded with supporting evidence."),
    "HIRE-10": ("Update about your KRAVIA application", "The hiring team has recorded a change to your application status."),
}


def render_office_candidate_notice(
    *, event_code: str, recipient_name: str,
    interview_time: str | None = None,
) -> TransactionalEmail:
    if event_code not in _NOTICES:
        raise ValueError("Unsupported hiring notification code")
    name = recipient_name.strip()
    if not 2 <= len(name) <= 220 or any(ord(c) < 32 for c in name):
        raise ValueError("Invalid candidate recipient name")
    if event_code in {"HIRE-02", "HIRE-03"}:
        if (interview_time is None or not 6 <= len(interview_time) <= 90
                or any(ord(c) < 32 for c in interview_time)):
            raise ValueError("Verified interview schedule is required")
    elif interview_time is not None:
        raise ValueError("Interview time is not permitted for this event")

    subject, message = _NOTICES[event_code]
    timing = (
        f"\nScheduled time: {interview_time}."
        if interview_time is not None else ""
    )
    html_timing = (
        f"<p>Scheduled time: <strong>{escape(interview_time)}</strong>.</p>"
        if interview_time is not None else ""
    )
    note = (
        "Do not send identity documents or bank details by replying to this "
        "notice. Confirm any required next step through the hiring coordinator."
    )
    html = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '</head><body style="margin:0;background:#f7f7f8;color:#111827;'
        'font:15px/1.65 Arial,sans-serif">'
        '<main style="max-width:590px;margin:25px auto;padding:25px;'
        'border:1px solid #e5e7eb;background:#ffffff;border-radius:12px">'
        '<p style="font-size:13px;letter-spacing:.08em;font-weight:700">'
        'KRAVIA PRIVATE LIMITED</p>'
        f'<h1 style="font-size:20px;line-height:1.35">{escape(subject)}</h1>'
        f'<p>Hello {escape(name)},</p><p>{escape(message)}</p>'
        f'{html_timing}<p>{escape(note)}</p>'
        '<p>For questions, contact '
        '<a href="mailto:hello@kraviaprivatelimited.com">'
        'hello@kraviaprivatelimited.com</a>.</p>'
        '<p style="font-size:12px;color:#6b7280">This is a candidate '
        'notification, not an invitation to sign in to KRAVIA Office. '
        'No confidential document or account link is attached.</p>'
        '</main></body></html>'
    )
    plain = (
        f"KRAVIA PRIVATE LIMITED\n{subject}\n\nHello {name},\n\n"
        f"{message}{timing}\n\n{note}\n"
        "Questions: hello@kraviaprivatelimited.com\n"
        "This notice contains no protected Office or document link."
    )
    return TransactionalEmail(
        subject=subject,
        html_content=html,
        text_content=plain,
    )
