"""Read-only Brevo API/sender/domain readiness check for KRAVIA Office.

This module does not send email, register a sender, modify DNS or reveal
credentials. Use it on the trusted Railway API/worker host with its existing
BREVO_* environment variables. A successful check is configuration evidence,
not an inbox-delivery claim.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from typing import Any

import httpx

BREVO_API_ROOT = "https://api.brevo.com/v3"
EXPECTED_SENDER_DOMAIN = "kraviaprivatelimited.com"
ADDRESS_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$")


def inspect_brevo(*, probe: bool = False, transport: httpx.BaseTransport | None = None) -> dict[str, Any]:
    """Return a PII-free operational diagnosis without mutating a provider."""
    key = os.getenv("BREVO_API_KEY", "").strip()
    sender = os.getenv("BREVO_SENDER_EMAIL", "").strip().lower()
    display_name = os.getenv("BREVO_SENDER_NAME", "").strip()
    domain = sender.rpartition("@")[2]
    timeout_raw = os.getenv("BREVO_API_TIMEOUT_SECONDS", "10")
    flags: dict[str, Any] = {
        "provider": "BREVO",
        "operation": "READ_ONLY_PREFLIGHT",
        "key_configured": bool(key),
        "sender_address_configured": bool(ADDRESS_PATTERN.fullmatch(sender)),
        "sender_domain_matches": domain == EXPECTED_SENDER_DOMAIN,
        "sender_name_configured": bool(display_name),
        "network_probe_requested": probe,
        "provider_authenticated": False,
        "sender_active": False,
        "domain_verified": False,
        "domain_authenticated": False,
        "provider_configuration_verified": False,
        "mailbox_delivery_verified": False,
        "failure_codes": [],
    }
    try:
        timeout = float(timeout_raw)
        if not 1 <= timeout <= 30:
            raise ValueError
    except (ValueError, TypeError):
        flags["failure_codes"].append("INVALID_TIMEOUT")
        return flags

    if not key:
        flags["failure_codes"].append("MISSING_API_KEY")
    if not flags["sender_address_configured"]:
        flags["failure_codes"].append("INVALID_SENDER")
    if not flags["sender_domain_matches"]:
        flags["failure_codes"].append("UNAPPROVED_SENDER_DOMAIN")
    if not flags["sender_name_configured"]:
        flags["failure_codes"].append("MISSING_SENDER_NAME")
    if flags["failure_codes"] or not probe:
        return flags

    headers = {"api-key": key, "accept": "application/json"}
    with httpx.Client(timeout=timeout, transport=transport) as client:
        def get_json(url: str) -> tuple[dict[str, Any] | None, str | None]:
            try:
                response = client.get(url, headers=headers)
            except httpx.HTTPError:
                return None, "BREVO_TRANSPORT_FAILURE"
            if response.status_code != 200:
                return None, f"BREVO_HTTP_{response.status_code}"
            try:
                body = response.json()
            except ValueError:
                return None, "BREVO_INVALID_JSON"
            if not isinstance(body, dict):
                return None, "BREVO_INVALID_SCHEMA"
            return body, None

        account, error = get_json(BREVO_API_ROOT + "/account")
        if error:
            flags["failure_codes"].append("ACCOUNT_" + error)
            return flags
        flags["provider_authenticated"] = account is not None

        senders, error = get_json(BREVO_API_ROOT + "/senders")
        if error:
            flags["failure_codes"].append("SENDERS_" + error)
        else:
            sender_rows = senders.get("senders")
            if not isinstance(sender_rows, list):
                flags["failure_codes"].append("SENDERS_INVALID_SCHEMA")
            else:
                match = next(
                    (row for row in sender_rows
                     if isinstance(row, dict)
                     and str(row.get("email") or "").strip().lower() == sender),
                    None,
                )
                if not match:
                    flags["failure_codes"].append("SENDER_NOT_REGISTERED")
                elif match.get("active") is not True:
                    flags["failure_codes"].append("SENDER_NOT_ACTIVE")
                else:
                    flags["sender_active"] = True

        domain_state, error = get_json(BREVO_API_ROOT + "/senders/domains/" + domain)
        if error:
            flags["failure_codes"].append("DOMAIN_" + error)
        else:
            flags["domain_verified"] = domain_state.get("verified") is True
            flags["domain_authenticated"] = domain_state.get("authenticated") is True
            if not flags["domain_verified"]:
                flags["failure_codes"].append("DOMAIN_NOT_VERIFIED")
            if not flags["domain_authenticated"]:
                flags["failure_codes"].append("DOMAIN_NOT_AUTHENTICATED")

    flags["provider_configuration_verified"] = (
        flags["provider_authenticated"]
        and flags["sender_active"]
        and flags["domain_verified"]
        and flags["domain_authenticated"]
        and not flags["failure_codes"]
    )
    return flags


def main() -> int:
    parser = argparse.ArgumentParser(description="Brevo read-only verification; never sends email")
    parser.add_argument("--probe", action="store_true", help="Make read-only GET calls to Brevo")
    args = parser.parse_args()
    result = inspect_brevo(probe=args.probe)
    print(json.dumps(result, sort_keys=True))
    return 0 if result["provider_configuration_verified"] else (2 if result["failure_codes"] else 1)


if __name__ == "__main__":
    raise SystemExit(main())
