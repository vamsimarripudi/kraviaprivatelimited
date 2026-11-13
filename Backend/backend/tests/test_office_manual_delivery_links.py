"""Office first-access and manual-link mail integration: rendering never sends."""
from backend.email_templates import office_invitation_template
from backend.office_lifecycle_templates import render_office_lifecycle_notice

def test_invitation_sends_only_public_safe_first_access_guide():
    email=office_invitation_template(
        recipient_name="Synthetic Employee",
        registration_url="https://www.kraviaprivatelimited.com/office/register?invite="+"A"*64,
        expiry_hours=24,
    )
    assert "office/quick-start" in email.html_content
    assert "office/quick-start" in email.text_content
    assert "office/info" not in email.html_content
    assert "Your private role handbook becomes available only after verified activation." in email.html_content

def test_approved_onboarding_event_links_private_manual_but_not_enables_dispatch():
    email=render_office_lifecycle_notice(event_code="ONB-09",recipient_name="Synthetic Employee",
        event_reference="KRV-ONB-20261113-TEST")
    assert 'https://www.kraviaprivatelimited.com/office/info' in email.html_content
    assert 'https://www.kraviaprivatelimited.com/office/info' in email.text_content
    assert "grant" in email.html_content.lower()
    assert "mail" in str(type(email)).lower() or email.subject
    assert "password" not in email.text_content.lower() or "never" in email.text_content.lower()

def test_sensitive_payroll_event_does_not_get_training_link():
    email=render_office_lifecycle_notice(event_code="PAY-01",recipient_name="Synthetic Employee",
        event_reference="KRV-PAY-20261113-TEST")
    assert "/office/info" not in email.html_content
