import pytest

from backend import email_delivery
from backend.email_templates import kravia_welcome_template, office_email_verification_template, public_form_follow_up_template, public_form_receipt_template, public_intake_internal_notification_template


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


def test_kravia_verification_template_has_safe_single_use_copy():
    template = office_email_verification_template(code="482915", expiry_minutes=10)

    assert template.subject == "482915 is your KRAVIA verification code"
    assert "482915" in template.html_content
    assert "Do not share" in template.html_content
    assert "hello@kraviaprivatelimited.com" not in template.html_content
    assert "482915" in template.text_content


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
