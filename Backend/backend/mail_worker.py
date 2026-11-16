"""Isolated, opt-in KRAVIA Office Brevo dispatch worker.

Unlike the general automation worker, this process does not depend on ClamAV,
file scanning or unrelated Office automation. Enabling this service alone
NEVER authorizes a message: each source is still protected by independent
database policies, real business-event evidence, and recipient verification.
No plaintext credentials, OTPs, recipient addresses or message bodies are logged.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import threading
import time
from typing import Any, Callable

from .email_delivery import close_email_delivery_client
from .office_employee_mail_worker import process_employee_mail_outbox
from .office_lifecycle_mail_worker import process_office_lifecycle_mail_outbox
from .office_candidate_mail_worker import process_candidate_mail_outbox
from .office_external_notice_worker import process_external_notice_outbox
from .office_invitation_notice_worker import process_invitation_notices

logger = logging.getLogger(__name__)
DISPATCHERS: tuple[tuple[str, Callable[[int], dict[str, Any]]], ...] = (
    ("employee_id", process_employee_mail_outbox),
    ("lifecycle", process_office_lifecycle_mail_outbox),
    ("candidate", process_candidate_mail_outbox),
    ("external", process_external_notice_outbox),
    ("invitation_notice", process_invitation_notices),
)


def _flag(name: str) -> bool:
    value = os.getenv(name, "false").strip().lower()
    if value in ("", "0", "false", "off", "no"):
        return False
    if value in ("1", "true", "on", "yes"):
        return True
    raise RuntimeError("Invalid mail-worker flag: " + name)


def _bounded_int(name: str, default: int, lower: int, upper: int) -> int:
    try:
        candidate = int(os.getenv(name, str(default)))
    except ValueError:
        candidate = default
    return max(lower, min(candidate, upper))


def process_mail_once(batch_size: int = 10) -> dict[str, Any]:
    if not _flag("KRAVIA_MAIL_WORKER_ENABLED"):
        return {"status": "DISABLED", "claimed": 0, "provider": "BREVO"}
    if not os.getenv("BREVO_API_KEY", "").strip():
        return {"status": "PROVIDER_NOT_CONFIGURED", "claimed": 0, "provider": "BREVO"}
    batch = max(1, min(batch_size, 25))
    results: dict[str, Any] = {}
    failures: list[str] = []
    for name, dispatcher in DISPATCHERS:
        try:
            outcome = dispatcher(batch)
            # Every dispatcher must return only PII-free aggregate counts.
            results[name] = {
                key: outcome.get(key)
                for key in ("status", "claimed", "accepted", "rejected", "unknown", "finalization_failures")
                if key in outcome
            }
            if outcome.get("status") == "NEEDS_RECONCILIATION":
                failures.append(name)
        except Exception as exc:
            logger.error("brevo_mail_worker_failed kind=%s type=%s", name, type(exc).__name__)
            results[name] = {"status": "NEEDS_RECONCILIATION", "error_type": type(exc).__name__}
            failures.append(name)
    return {
        "status": "NEEDS_RECONCILIATION" if failures else "COMPLETED",
        "provider": "BREVO",
        "claimed": sum(int(row.get("claimed") or 0) for row in results.values()),
        "channels": results,
    }


def run_forever() -> int:
    interval = _bounded_int("KRAVIA_MAIL_WORKER_INTERVAL_SECONDS", 60, 10, 3600)
    batch = _bounded_int("KRAVIA_MAIL_WORKER_BATCH_SIZE", 10, 1, 25)
    stop = threading.Event()

    def terminate(_signal, _frame):
        stop.set()

    signal.signal(signal.SIGTERM, terminate)
    signal.signal(signal.SIGINT, terminate)
    print(json.dumps({"event": "brevo_mail_worker.started", "interval_seconds": interval}), flush=True)
    try:
        while not stop.is_set():
            started = time.monotonic()
            try:
                result = process_mail_once(batch)
                print(json.dumps({"event": "brevo_mail_worker.tick", **result}, sort_keys=True), flush=True)
            except Exception as exc:
                print(json.dumps({"event": "brevo_mail_worker.tick_failed", "error_type": type(exc).__name__}), flush=True)
            stop.wait(max(0, interval - (time.monotonic() - started)))
    finally:
        close_email_delivery_client()
        print(json.dumps({"event": "brevo_mail_worker.stopped"}), flush=True)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="KRAVIA opt-in Brevo mail-only worker")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if args.once:
        result = process_mail_once(_bounded_int("KRAVIA_MAIL_WORKER_BATCH_SIZE", 10, 1, 25))
        print(json.dumps(result, sort_keys=True))
        close_email_delivery_client()
        return 0 if result["status"] in ("DISABLED", "COMPLETED") else 2
    return run_forever()


if __name__ == "__main__":
    raise SystemExit(main())
