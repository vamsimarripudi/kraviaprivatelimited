import json
from pathlib import Path

import pytest

from backend import email_delivery
from backend.email_templates import kravia_welcome_template, office_device_approval_template, office_email_verification_template, office_invitation_template, office_workspace_ready_template, public_form_follow_up_template, public_form_receipt_template, public_intake_internal_notification_template


class FakeResponse:
    def __init__(self, status_code, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class FakeClient:
    response = FakeResponse(201, {"messageId": "provider-message-123"})
    calls = []

    def __init__(self, **kwargs):
        self.options = kwargs

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def post(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        return self.response

    def close(self):
        return None


@pytest.fixture(autouse=True)
def reset_email_delivery_client():
    """Keep the process-level HTTP pool isolated between delivery tests."""
    email_delivery.close_email_delivery_client()
    yield
    email_delivery.close_email_delivery_client()


def test_kravia_verification_template_has_safe_single_use_copy():
    template = office_email_verification_template(code="482915", expiry_minutes=10)

    assert template.subject == "482915 is your KRAVIA verification code"
    assert "482915" in template.html_content
    assert "Do not share" in template.html_content
    assert "ONE-TIME SIGN-IN CODE" in template.html_content
    assert 'name="color-scheme"' in template.html_content
    assert "background-color:#193B5B" in template.html_content
    assert "color:#FFFFFF" in template.html_content
    assert "hello@kraviaprivatelimited.com" not in template.html_content
    assert "482915" in template.text_content


def test_device_approval_template_names_the_device_without_creating_a_session():
    template = office_device_approval_template(
        device_label="Chrome on Windows device",
        source_address="203.0.113.10",
        review_url="https://www.kraviaprivatelimited.com/office/device-approval/confirm?id=11111111-1111-4111-8111-111111111111&token=synthetic-token-value-which-is-long-enough-123456",
    )

    assert template.subject == "Review a new KRAVIA Office device sign-in"
    assert "Chrome on Windows device" in template.html_content
    assert "203.0.113.10" in template.text_content
    assert "Review this sign-in" in template.text_content
    assert "company-provided app" in template.text_content
    assert "original device" in template.text_content
    assert "access_token" not in template.html_content


def test_public_form_receipt_has_kravia_header_footer_and_no_request_body():
    template = public_form_receipt_template(
        form_kind="TRUST_REQUEST",
        recipient_name="Synthetic Recipient",
        reference="KRV-ABCDEF0123456789ABCDEF01",
    )

    assert template.subject == "We received your KRAVIA privacy or Trust request"
    assert "KRAVIA PRIVATE LIMITED" in template.html_content
    assert "/brand/kravia-header-lockup-v2.png" in template.html_content
    assert "#193B5B" in template.html_content
    assert "Legal notices and terms" in template.html_content
    assert "/trust/privacy" in template.html_content
    assert "Synthetic Recipient" in template.text_content
    assert "password" in template.text_content


def test_kravia_welcome_template_has_branded_header_footer_and_safe_copy():
    template = kravia_welcome_template(recipient_name="Synthetic Recipient")

    assert template.subject == "Welcome to KRAVIA"
    assert "Welcome to KRAVIA" in template.html_content
    assert "/brand/kravia-header-lockup-v2.png" in template.html_content
    assert "Georgia" in template.html_content
    assert "Arial" in template.html_content
    assert "#193B5B" in template.html_content
    assert "Legal notices and terms" in template.html_content
    assert "Synthetic Recipient" in template.text_content
    assert "You belong here" in template.text_content
    assert "With warm wishes" in template.text_content
    assert "password" in template.text_content


def test_internal_intake_notification_identifies_the_requester_without_copying_request_content():
    template = public_intake_internal_notification_template(
        form_kind="CONTACT",
        sender_name="Synthetic Recipient",
        sender_email="recipient@example.test",
        reference="KRV-ABCDEF0123456789ABCDEF01",
        request_subject="Synthetic public request",
        organisation="Synthetic Organisation",
    )

    assert template.subject == "New KRAVIA contact request · KRV-ABCDEF0123456789ABCDEF01"
    assert "recipient@example.test" in template.html_content
    assert "Synthetic public request" in template.text_content
    assert "full request remains" in template.text_content


def test_public_follow_up_template_escapes_reviewer_text_and_keeps_reference():
    template = public_form_follow_up_template(
        form_kind="CONTACT",
        recipient_name="Synthetic Recipient",
        reference="KRV-ABCDEF0123456789ABCDEF01",
        message="We reviewed your <request>.\nPlease use the contact form for any additional details.",
    )
    assert "Update on your KRAVIA contact request" in template.subject
    assert "KRV-ABCDEF0123456789ABCDEF01" in template.html_content
    assert "Synthetic Recipient" in template.text_content
    assert "&lt;request&gt;" in template.html_content
    assert "<request>" not in template.html_content
    assert "Legal notices and terms" in template.html_content


def test_react_email_manifest_has_no_unresolved_tokens_or_executable_markup():
    templates = [
        office_email_verification_template(code="482915", expiry_minutes=10),
        public_form_receipt_template(
            form_kind="CONTACT",
            recipient_name="Synthetic Recipient",
            reference="KRV-ABCDEF0123456789ABCDEF01",
        ),
        public_form_follow_up_template(
            form_kind="SUPPORT",
            recipient_name="Synthetic Recipient",
            reference="KRV-SUP-AB12CD34",
            message="Synthetic reply.",
        ),
        kravia_welcome_template(recipient_name="Synthetic Recipient"),
        office_device_approval_template(
            device_label="Synthetic browser",
            source_address="203.0.113.10",
            review_url="https://www.kraviaprivatelimited.com/office/device-approval/confirm?id=11111111-1111-4111-8111-111111111111&token=synthetic-token-value-which-is-long-enough-123456",
        ),
    ]
    for template in templates:
        assert "@@KRAVIA_" not in template.html_content
        assert "@@KRAVIA_" not in template.text_content
        assert "<script" not in template.html_content.lower()
        assert "javascript:" not in template.html_content.lower()


def test_verification_template_rejects_non_six_digit_codes():
    with pytest.raises(ValueError, match="Invalid verification code"):
        office_email_verification_template(code="<script>", expiry_minutes=10)


def test_brevo_delivery_uses_backend_key_sender_and_idempotency(monkeypatch):
    FakeClient.calls = []
    FakeClient.response = FakeResponse(201, {"messageId": "provider-message-123"})
    monkeypatch.setenv("BREVO_API_KEY", "test-key-not-a-production-secret")
    monkeypatch.delenv("BREVO_SENDER_EMAIL", raising=False)
    monkeypatch.setattr(email_delivery.httpx, "Client", FakeClient)

    receipt = email_delivery.send_office_email_verification_code(
        recipient_email="member@example.test",
        code="482915",
        expiry_minutes=10,
        delivery_id="email-otp:challenge-1:1",
    )

    assert receipt == "provider-message-123"
    call = FakeClient.calls[0]
    assert call["url"] == email_delivery.BREVO_EMAIL_ENDPOINT
    assert call["headers"]["api-key"] == "test-key-not-a-production-secret"
    assert call["json"]["sender"] == {"name": "KRAVIA", "email": "hello@kraviaprivatelimited.com"}
    assert call["json"]["to"] == [{"email": "member@example.test"}]
    assert call["json"]["headers"]["Idempotency-Key"] == "email-otp:challenge-1:1"
    assert call["json"]["tags"] == ["kravia-office-auth", "email-otp"]


def test_brevo_delivery_reuses_the_process_client_for_consecutive_otps(monkeypatch):
    class PooledFakeClient(FakeClient):
        created = 0

        def __init__(self, **kwargs):
            super().__init__(**kwargs)
            type(self).created += 1

    PooledFakeClient.calls = []
    PooledFakeClient.response = FakeResponse(201, {"messageId": "provider-message-pooled"})
    monkeypatch.setenv("BREVO_API_KEY", "test-key-not-a-production-secret")
    monkeypatch.setattr(email_delivery.httpx, "Client", PooledFakeClient)

    email_delivery.send_office_email_verification_code(
        recipient_email="first@example.test",
        code="482915",
        expiry_minutes=10,
        delivery_id="email-otp:challenge-1:1",
    )
    email_delivery.send_office_email_verification_code(
        recipient_email="second@example.test",
        code="593741",
        expiry_minutes=10,
        delivery_id="email-otp:challenge-2:1",
    )

    assert PooledFakeClient.created == 1
    assert len(PooledFakeClient.calls) == 2


def test_device_approval_delivery_uses_the_verified_sender(monkeypatch):
    FakeClient.calls = []
    FakeClient.response = FakeResponse(201, {"messageId": "device-approval-message"})
    monkeypatch.setenv("BREVO_API_KEY", "test-key-not-a-production-secret")
    monkeypatch.setattr(email_delivery.httpx, "Client", FakeClient)

    receipt = email_delivery.send_office_device_approval(
        recipient_email="member@example.test",
        device_label="Synthetic browser",
        source_address="203.0.113.10",
        review_url="https://www.kraviaprivatelimited.com/office/device-approval/confirm?id=11111111-1111-4111-8111-111111111111&token=synthetic-token-value-which-is-long-enough-123456",
        delivery_id="device-approval:11111111-1111-4111-8111-111111111111",
    )
    assert receipt == "device-approval-message"
    call = FakeClient.calls[0]
    assert call["json"]["sender"]["email"] == "hello@kraviaprivatelimited.com"
    assert call["json"]["tags"] == ["kravia-office-auth", "device-approval"]


def test_brevo_rejection_is_not_misreported_as_sent(monkeypatch):
    FakeClient.response = FakeResponse(401)
    monkeypatch.setenv("BREVO_API_KEY", "test-key-not-a-production-secret")
    monkeypatch.setattr(email_delivery.httpx, "Client", FakeClient)

    with pytest.raises(email_delivery.EmailDeliveryRejected):
        email_delivery.send_office_email_verification_code(
            recipient_email="member@example.test",
            code="482915",
            expiry_minutes=10,
            delivery_id="email-otp:challenge-1:1",
        )


def test_internal_intake_notification_goes_to_hello_and_replies_to_the_requester(monkeypatch):
    FakeClient.calls = []
    FakeClient.response = FakeResponse(201, {"messageId": "provider-message-456"})
    monkeypatch.setenv("BREVO_API_KEY", "test-key-not-a-production-secret")
    monkeypatch.setattr(email_delivery.httpx, "Client", FakeClient)

    receipt = email_delivery.send_public_intake_internal_notification(
        form_kind="CONTACT",
        sender_name="Synthetic Recipient",
        sender_email="recipient@example.test",
        reference="KRV-ABCDEF0123456789ABCDEF01",
        request_subject="Synthetic public request",
        organisation="Synthetic Organisation",
        delivery_id="public-internal:contact:KRV-ABCDEF0123456789ABCDEF01",
    )

    assert receipt == "provider-message-456"
    call = FakeClient.calls[0]
    assert call["json"]["sender"] == {"name": "KRAVIA", "email": "hello@kraviaprivatelimited.com"}
    assert call["json"]["to"] == [{"email": "hello@kraviaprivatelimited.com"}]
    assert call["json"]["replyTo"] == {"name": "Synthetic Recipient", "email": "recipient@example.test"}
    assert call["json"]["tags"] == ["kravia-public-intake", "internal-notification", "contact"]


def test_sender_must_remain_the_verified_kravia_address(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "test-key-not-a-production-secret")
    monkeypatch.setenv("BREVO_SENDER_EMAIL", "other@example.test")

    with pytest.raises(email_delivery.EmailDeliveryUnavailable):
        email_delivery.send_office_email_verification_code(
            recipient_email="member@example.test",
            code="482915",
            expiry_minutes=10,
            delivery_id="email-otp:challenge-1:1",
        )


def test_all_corporate_transactional_email_footers_have_verified_social_links():
    manifest_path = Path(__file__).resolve().parents[1] / "generated_email_templates.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected_profiles = {
        "LinkedIn": "https://linkedin.com/company/kravia-private-limited",
        "X": "https://x.com/KraviaOfficial",
        "Instagram": "https://www.instagram.com/kravia_private_limited/",
        "Facebook": "https://www.facebook.com/profile.php?id=61595906774125",
    }
    assert len(manifest["templates"]) == 16
    for name, template in manifest["templates"].items():
        assert "CONNECT WITH KRAVIA" in template["html"], name
        assert "ACCOUNT SAFETY" in template["html"], name
        assert "Legal notices and terms" in template["html"], name
        for label, url in expected_profiles.items():
            assert f'href="{url}"' in template["html"], (name, label)
            assert f"{label} {url}" in template["text"], (name, label)

def test_all_six_distinct_email_layouts_link_the_official_social_icons():
    from backend.email_templates import _manifest

    templates = _manifest()
    expected = {
        "LinkedIn": ("linkedin-v2.png", "https://linkedin.com/company/kravia-private-limited"),
        "X": ("x.png", "https://x.com/KraviaOfficial"),
        "Instagram": ("instagram-v2.png", "https://www.instagram.com/kravia_private_limited/"),
        "Facebook": ("facebook.png", "https://www.facebook.com/profile.php?id=61595906774125"),
    }
    assert len(templates) == 16
    for name, template in templates.items():
        html = template["html"]
        plain = template["text"]
        assert "ACCOUNT SAFETY" in html and "Legal notices and terms" in html, name
        assert "/brand/kravia-header-lockup-v2.png" in html, name
        assert "CONNECT WITH KRAVIA" in html and "CONNECT WITH KRAVIA" in plain, name
        for label, (asset, url) in expected.items():
            assert f"/brand/email/{asset}" in html, (name, label)
            assert 'width="36" height="36"' in html, name
            assert '.gif' not in html, name
            assert f'href="{url}"' in html, (name, label)
            assert f"{label} {url}" in plain, (name, label)

    assert len({template["html"] for template in templates.values()}) == 16
    assert "ONE-TIME SIGN-IN CODE" in templates["office_sign_in_code"]["html"]
    assert "UNRECOGNIZED DEVICE CHECK" in templates["office_device_approval"]["html"]
    assert "RECEIVED · CONFIRMED" in templates["public_request_received"]["html"]
    assert "LATEST MESSAGE" in templates["public_request_update"]["html"]
    assert "ACTION · REVIEW IN OFFICE" in templates["public_intake_internal_notification"]["html"]
    assert "A NOTE FROM KRAVIA" in templates["public_welcome"]["html"]


def test_public_access_mail_catalog_is_safe_and_separately_branded():
    from backend.email_templates import public_access_mail_template, PUBLIC_ACCESS_MAIL_TYPES

    assert len(PUBLIC_ACCESS_MAIL_TYPES) == 10
    verification = public_access_mail_template(kind="ACCOUNT_CODE", recipient_name="Sample User", code="482915")
    assert "482915" in verification.html_content
    assert "KRAVIA Office" not in verification.html_content
    assert "NEWSLETTER" not in verification.html_content
    assert "linkedin-v2.png" in verification.html_content
    assert "instagram-v2.png" in verification.html_content
    with pytest.raises(ValueError):
        public_access_mail_template(kind="ACCOUNT_CODE", recipient_name="Sample User", code="invalid")
    with pytest.raises(ValueError):
        public_access_mail_template(
            kind="NEWSLETTER_CONFIRM", recipient_name="Sample User",
            action_url="https://example.org/confirm?token=abc"
        )
    digest = public_access_mail_template(
        kind="NEWSLETTER_DIGEST", recipient_name="Sample User",
        issue_subject="Approved company update", message="<unsafe>",
        unsubscribe_url="https://www.kraviaprivatelimited.com/newsletter/unsubscribe?token=" + "a"*43
    )
    assert "&lt;unsafe&gt;" in digest.html_content
    assert "Unsubscribe" in digest.html_content


def test_employee_invitation_email_includes_official_google_play_badge_and_plain_text_fallback():
    invite = office_invitation_template(
        recipient_name="Sample & Teammate",
        registration_url="https://kraviaprivatelimited.com/office/register?invite=" + "a" * 64,
        expiry_hours=72,
    )
    link = "https://play.google.com/store/apps/details?id=com.kraviaprivatelimited.authenticator"
    badge = "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
    assert invite.subject == "You are invited to KRAVIA Office"
    assert "Accept Invitation" in invite.html_content
    assert link in invite.html_content and link in invite.text_content
    assert badge in invite.html_content and 'alt="Get it on Google Play"' in invite.html_content
    assert "/office/authenticator" in invite.html_content
    assert "Sample &amp; Teammate" in invite.html_content
    assert "Sample & Teammate" in invite.text_content
    assert "\n\nYou have been invited" in invite.text_content
    assert "\\n" not in invite.text_content
    assert "Your workspace remains locked until access approval" in invite.text_content


def test_workspace_approved_email_has_google_play_install_link_and_no_private_tokens():
    ready = office_workspace_ready_template(recipient_name="Sample <Employee>")
    link = "https://play.google.com/store/apps/details?id=com.kraviaprivatelimited.authenticator"
    assert ready.subject == "Your KRAVIA Office workspace is ready"
    assert "Sample &lt;Employee&gt;" in ready.html_content
    assert "Your requested KRAVIA Office workspace access has been approved" in ready.html_content
    assert "Open KRAVIA Office" in ready.html_content
    assert link in ready.html_content and link in ready.text_content
    assert 'alt="Get it on Google Play"' in ready.html_content
    assert "sample-token" not in ready.html_content.lower()
    assert "invite=" not in ready.html_content
    assert "Sample <Employee>" in ready.text_content


def test_ready_email_sends_only_when_explicitly_invoked(monkeypatch):
    FakeClient.calls = []
    FakeClient.response = FakeResponse(201, {"messageId": "workspace-ready-provider-id"})
    monkeypatch.setenv("BREVO_API_KEY", "test-key-not-a-production-secret")
    monkeypatch.setattr(email_delivery.httpx, "Client", FakeClient)
    assert FakeClient.calls == []
    receipt = email_delivery.send_office_workspace_ready_email(
        recipient_email="employee@example.test",
        recipient_name="Office Employee",
        delivery_id="office-workspace-ready-test-employee",
    )
    assert receipt == "workspace-ready-provider-id"
    assert len(FakeClient.calls) == 1
    payload = FakeClient.calls[0]["json"]
    assert payload["sender"]["email"] == "hello@kraviaprivatelimited.com"
    assert payload["to"] == [{"email": "employee@example.test"}]
    assert payload["tags"] == ["kravia-office-auth", "workspace-ready"]
    assert payload["headers"]["Idempotency-Key"] == "office-workspace-ready-test-employee"
    assert "play.google.com/store/apps/details?id=com.kraviaprivatelimited.authenticator" in payload["htmlContent"]
