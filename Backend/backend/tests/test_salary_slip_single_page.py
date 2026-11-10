"""PDF visual/structure release gate for KRAVIA's one-page salary statements."""
from io import BytesIO

from pypdf import PdfReader

from backend.document_engine import DocumentRenderRequest, render_document


def test_locked_wage_statement_uses_one_a4_page_and_preserves_unpaid_evidence():
    slip = DocumentRenderRequest(
        document_code="KPL-PAY-FIXTURE-202608",
        title="KRAVIA PRIVATE LIMITED | Wage Slip | 2026-08",
        output_format="PDF",
        design_schema={
            "page_size": "A4",
            "font_size": 9,
            "margins_mm": {"left": 16, "right": 16, "top": 16, "bottom": 16},
            "watermark": "CONFIDENTIAL",
            "footer_text": "PRIVATE EMPLOYEE RECORD | KRAVIA PRIVATE LIMITED",
        },
        content_schema=[
            {"type": "heading", "level": 2, "text": "KRAVIA PRIVATE LIMITED"},
            {"type": "paragraph", "text": "CIN: U62011AP2026PTC126691 | CONFIDENTIAL EMPLOYEE PAY RECORD"},
            {"type": "heading", "level": 1, "text": "SALARY SLIP / WAGE STATEMENT"},
            {"type": "key_value", "items": [
                {"label": "Employee", "value": "Example Employee"},
                {"label": "Employee ID", "value": "KPL-EMP-001"},
                {"label": "Wage period", "value": "2026-08-01 to 2026-08-31"},
                {"label": "Slip reference", "value": "KPL-PAY-EMP-202608"},
                {"label": "Issue timestamp", "value": "2026-09-01T11:00:00Z"},
                {"label": "Annual gross reference", "value": "INR 4,80,000.00"},
                {"label": "Monthly gross reference", "value": "INR 40,000.00"},
                {"label": "Company target due date", "value": "2026-08-28"},
            ]},
            {"type": "table", "rows": [
                ["EARNINGS / DEDUCTIONS", "AMOUNT"],
                ["Approved regular earnings", "INR 40,000.00"],
                ["Approved additional earnings (includes OT, if any)", "INR 5,538.46"],
                ["Gross earned", "INR 45,538.46"],
                ["Approved lawful deductions", "INR 200.00"],
                ["NET WAGES PAYABLE", "INR 45,338.46"],
                ["Independently verified bank credits", "INR 0.00"],
                ["OUTSTANDING / UNVERIFIED BALANCE", "INR 45,338.46"],
            ]},
            {"type": "key_value", "items": [
                {"label": "Payment status", "value": "UNPAID / UNVERIFIED AFTER DUE DATE"},
                {"label": "Verified credit count", "value": "0"},
                {"label": "Payroll calculation reference", "value": "sha256fixturelockedxxxxxx"},
            ]},
            {"type": "paragraph", "text": "Payment classification reflects only independently reviewed settlement records. A prepared salary batch is NOT bank payment. If money was transferred but has not yet been verified, the balance remains unverified rather than falsely marked PAID."},
            {"type": "paragraph", "text": "This wage statement records approved earned wages. An unpaid or partly paid balance remains payable, with any additional contractual relief tracked separately. Contact the authorised company director for correction requests."},
        ],
    )
    document = PdfReader(BytesIO(render_document(slip).content))
    assert len(document.pages) == 1, "Payslip must fit on exactly one A4 page"
    page = document.pages[0]
    assert abs(float(page.mediabox.width) - 595.2756) < 2
    text = page.extract_text()
    assert "KRAVIA PRIVATE LIMITED" in text
    assert "UNPAID / UNVERIFIED AFTER DUE DATE" in text
    assert "OUTSTANDING / UNVERIFIED BALANCE" in text
    assert "45,338.46" in text
