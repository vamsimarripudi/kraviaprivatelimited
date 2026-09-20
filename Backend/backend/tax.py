"""Canonical GST rate and IT-service classification references for KRAVIA Office.

This module deliberately separates the GSTN/IRP rate master from product tax
classification. A percentage being technically accepted by IRP does not make
that percentage legally applicable to a KRAVIA supply.
"""
from decimal import Decimal
import re

STANDARD_GST_RATES = (
    Decimal("0"),
    Decimal("0.5"),
    Decimal("1"),
    Decimal("2"),
    Decimal("3"),
    Decimal("5"),
    Decimal("12"),
    Decimal("18"),
    Decimal("28"),
    Decimal("40"),
)

IT_SERVICE_DEFAULT_RATE = Decimal("18")

CANONICAL_PRODUCT_SEEDS = (
    {"id": "PROD-VL", "code": "VL", "name": "VidyaLuma", "category": "Education technology", "status": "ACTIVE_CONFIG"},
    {"id": "PROD-RF", "code": "RF", "name": "RecruitFlow", "category": "Recruitment technology", "status": "ACTIVE_CONFIG"},
    {"id": "PROD-YK", "code": "YK", "name": "YUKTA", "category": "Healthcare technology", "status": "CONFIG_ONLY"},
    {"id": "PROD-VO", "code": "VO", "name": "VORIO", "category": "Field-service operations", "status": "CONFIG_ONLY"},
    {"id": "PROD-VM", "code": "VM", "name": "Vaanmeet", "category": "Video Conferencing", "status": "ACTIVE_CONFIG"},
    {"id": "PROD-VF", "code": "VF", "name": "VFormix", "category": "Forms & Workflow SaaS", "status": "ACTIVE_CONFIG"},
)

_HOSTED_SAAS_BASIS = (
    "Standard subscription supplies hosted application access and related platform services; "
    "the standard commercial model does not transfer ownership of software or intellectual-property rights. "
    "Use a separate tax profile when a contract is primarily software licensing, hosting-only, custom development or IT support."
)

PRODUCT_TAX_DEFAULTS = {
    "VL": {"sac": "998319", "gst_rate": Decimal("18"), "tax_treatment": "TAXABLE", "supply_model": "HOSTED_SAAS", "billing_enabled": True, "classification_basis": _HOSTED_SAAS_BASIS},
    "RF": {"sac": "998319", "gst_rate": Decimal("18"), "tax_treatment": "TAXABLE", "supply_model": "HOSTED_SAAS", "billing_enabled": True, "classification_basis": _HOSTED_SAAS_BASIS},
    "YK": {"sac": "998319", "gst_rate": Decimal("18"), "tax_treatment": "TAXABLE", "supply_model": "HOSTED_SAAS", "billing_enabled": False, "classification_basis": _HOSTED_SAAS_BASIS},
    "VO": {"sac": "998319", "gst_rate": Decimal("18"), "tax_treatment": "TAXABLE", "supply_model": "HOSTED_SAAS", "billing_enabled": False, "classification_basis": _HOSTED_SAAS_BASIS},
    "VM": {"sac": "998319", "gst_rate": Decimal("18"), "tax_treatment": "TAXABLE", "supply_model": "HOSTED_SAAS", "billing_enabled": True, "classification_basis": _HOSTED_SAAS_BASIS},
    "VF": {"sac": "998319", "gst_rate": Decimal("18"), "tax_treatment": "TAXABLE", "supply_model": "HOSTED_SAAS", "billing_enabled": True, "classification_basis": _HOSTED_SAAS_BASIS},
}

PRODUCT_TAX_SOURCE_REF = "CBIC Scheme of Classification of Services: SAC 998319; CBIC IT/ITES FAQ: IT services GST 18%"

IT_SERVICE_SACS = (
    {"code": "998313", "description": "Information technology consulting and support services"},
    {"code": "998314", "description": "Information technology design and development services"},
    {"code": "998315", "description": "Hosting and information technology infrastructure provisioning services"},
    {"code": "998316", "description": "Information technology infrastructure and network management services"},
    {"code": "998319", "description": "Other information technology services nowhere else classified"},
    {"code": "997331", "description": "Licensing services for the right to use computer software and databases"},
)

GST_SOURCE_REFERENCES = (
    {
        "authority": "GSTN-authorized IRIS IRP",
        "reference": "Validation rule 2240",
        "url": "https://einvoice6.gst.gov.in/content/validation-rules/",
        "note": "Standard rates listed as 0, 0.5, 1, 2, 3, 5, 12, 18 and 28.",
    },
    {
        "authority": "GSTN-authorized IRIS IRP",
        "reference": "Production release 21 Sep 2025",
        "url": "https://einvoice6.gst.gov.in/content/general-master/",
        "note": "40% was added to the Tax Rate Master; existing rates remained available.",
    },
    {
        "authority": "CBIC",
        "reference": "IT/ITES sectoral FAQ",
        "url": "https://cbic-gst.gov.in/hindi/sectoral-faq.html",
        "note": "GST on IT services is 18%; qualifying exports and SEZ supplies are zero-rated subject to law.",
    },
    {
        "authority": "CBIC",
        "reference": "Scheme of Classification of Services",
        "url": "https://cbic-gst.gov.in/hindi/pdf/central-tax-rate/Notification11-CGST-Annexure.pdf",
        "note": "Official SAC descriptions used for the IT-service reference list.",
    },
)


def rate_text(rate: Decimal) -> str:
    text = format(rate, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def ensure_standard_gst_rate(value: Decimal) -> Decimal:
    rate = Decimal(value)
    if rate not in STANDARD_GST_RATES:
        allowed = ", ".join(rate_text(item) for item in STANDARD_GST_RATES)
        raise ValueError(f"GST rate must be one of the GSTN/IRP standard rates: {allowed}")
    return rate


def gst_master_payload() -> dict:
    return {
        "verified_on": "2026-09-20",
        "standard_rates": [rate_text(rate) for rate in STANDARD_GST_RATES],
        "it_services": {
            "default_rate": rate_text(IT_SERVICE_DEFAULT_RATE),
            "heading": "9983",
            "sacs": list(IT_SERVICE_SACS),
            "classification_note": (
                "18% is the CBIC rate for IT services. The exact SAC must match the actual supply "
                "and should be locked in the approved product tax configuration before production invoicing."
            ),
        },
        "calculation": {
            "intra_state": "CGST + SGST",
            "inter_state": "IGST",
            "zero_rate_note": (
                "A 0% rate alone does not establish exemption or zero-rating. Export, SEZ, nil-rated, "
                "exempt and non-GST treatments require separate legal facts and evidence."
            ),
        },
        "sources": list(GST_SOURCE_REFERENCES),
    }


def gstin_structure_status(gstin: str | None, state_code: str | None) -> dict:
    raw = (gstin or "").strip().upper()
    structure_valid = bool(re.fullmatch(r"[0-9]{2}[A-Z0-9]{10}[A-Z0-9]{2}[A-Z0-9]", raw))
    state_matches = bool(structure_valid and state_code and raw[:2] == str(state_code))
    masked = None
    if raw:
        masked = raw[:2] + ("*" * max(0, len(raw) - 5)) + raw[-3:]
    return {
        "configured": bool(raw),
        "masked": masked,
        "structure_valid": structure_valid,
        "state_matches": state_matches,
        "state_code": state_code,
        "portal_verification": "NOT_CONNECTED",
        "note": (
            "Structure validation checks the statutory GSTIN shape and supplier state code only. "
            "Active-registration status must be verified against the GST Common Portal or an approved GST integration."
        ),
    }
