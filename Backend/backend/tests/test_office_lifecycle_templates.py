"""Validate all 81 corporate Office lifecycle templates, without network or sends."""
from __future__ import annotations

import json
from pathlib import Path
import re

import pytest

from backend import office_lifecycle_templates as lifecycle
from backend.email_templates import TransactionalEmail

CATALOG = lifecycle.lifecycle_catalog()


def test_office_lifecycle_manifest_is_complete_and_off_by_default():
    source = Path(lifecycle.__file__).with_name("generated_office_lifecycle_templates.json")
    raw = json.loads(source.read_text(encoding="utf-8"))
    assert raw["total"] == 81
    assert raw["dispatchEnabled"] is False
    assert len(CATALOG) == 81
    assert lifecycle.lifecycle_catalog_status()["dispatch_enabled"] is False
    assert set(CATALOG) == set(raw["templates"])
    assert {prefix: sum(k.startswith(prefix + "-") for k in CATALOG)
            for prefix in ("AUTH", "HIRE", "ONB", "ROLE", "TIME", "PAY", "DEV", "EXIT")} == {
                "AUTH":12,"HIRE":10,"ONB":12,"ROLE":9,
                "TIME":10,"PAY":12,"DEV":8,"EXIT":8,
            }


@pytest.mark.parametrize("event_code",sorted(CATALOG))
def test_all_81_lifecycle_notices_are_escaped_and_never_claim_delivery(event_code):
    kwargs = dict(event_code=event_code,recipient_name='<script>Employee & Tester</script>',
                  event_reference="KRV-CI-20261113-001")
    if "{{pay_period}}" in CATALOG[event_code]["subject"]:
        kwargs["pay_period"] = "Nov 2026"
    rendered = lifecycle.render_office_lifecycle_notice(**kwargs)
    assert isinstance(rendered, TransactionalEmail)
    assert rendered.subject
    assert "KRAVIA PRIVATE LIMITED" in rendered.html_content
    assert "KRAVIA PRIVATE LIMITED" in rendered.text_content
    assert "kravia-header-lockup-v2.png" in rendered.html_content
    assert "&lt;script&gt;Employee &amp; Tester&lt;/script&gt;" in rendered.html_content
    assert "<script>Employee & Tester</script>" not in rendered.html_content
    assert "KRV-CI-20261113-001" in rendered.text_content
    assert event_code in rendered.html_content
    assert "{{" not in rendered.subject and "}}" not in rendered.subject
    assert "javascript:" not in rendered.html_content.lower()
    assert "<script" not in rendered.html_content.lower()
    assert "api.brevo.com" not in rendered.html_content


def test_normal_email_contains_real_first_name_and_private_cta():
    code = "ONB-01"
    notice = lifecycle.render_office_lifecycle_notice(
        event_code=code,recipient_name="Synthetic QA Employee",
        event_reference="KRV-CI-20261113-002",
        office_url="https://www.kraviaprivatelimited.com/office/my-role",
    )
    assert "Synthetic" in notice.subject
    assert "my-role" in notice.html_content
    assert "Synthetic QA Employee" in notice.text_content
    assert "KRV-CI-20261113-002" in notice.html_content


@pytest.mark.parametrize("bad", [
    "http://www.kraviaprivatelimited.com/office/dashboard",
    "https://kraviaprivatelimited.com/office/dashboard",
    "https://www.kraviaprivatelimited.com.evil.example/office/dashboard",
    "https://www.kraviaprivatelimited.com/public",
    "https://www.kraviaprivatelimited.com/office/../trust",
    "https://www.kraviaprivatelimited.com/office/%2e%2e/trust",
    "https://www.kraviaprivatelimited.com/office/dashboard#new",
    "https://www.kraviaprivatelimited.com/office/dashboard?redirect=https://evil.example",
    "https://person@www.kraviaprivatelimited.com/office/dashboard",
])
def test_untrusted_lifecycle_destination_rejected(bad):
    with pytest.raises(ValueError):
        lifecycle.render_office_lifecycle_notice(
            event_code="ROLE-01",recipient_name="Example User",
            event_reference="KRV-CI-20261113-003",office_url=bad,
        )


def test_rejects_header_injection_bad_reference_and_missing_pay_period():
    with pytest.raises(ValueError):
        lifecycle.render_office_lifecycle_notice(
            event_code="AUTH-04",recipient_name="Person\r\nBcc:bad@example.com",
            event_reference="KRV-CI-20261113-003",
        )
    with pytest.raises(ValueError):
        lifecycle.render_office_lifecycle_notice(
            event_code="PAY-06",recipient_name="Example User",event_reference="KRV-SAFE",
        ) if "{{pay_period}}" in CATALOG["PAY-06"]["subject"] else lifecycle.render_office_lifecycle_notice(
            event_code="PAY-06",recipient_name="Example User",event_reference="<unsafe>"
        )
    with pytest.raises(ValueError):
        lifecycle.render_office_lifecycle_notice(
            event_code="UNKNOWN-99",recipient_name="Example User",
            event_reference="KRV-CI-20261113-003",
        )
