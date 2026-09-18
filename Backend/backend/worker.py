"""Dedicated KRAVIA Office background worker.

The worker owns periodic internal automation and outbox processing. It deliberately
does not serve HTTP and does not perform provider execution. PostgreSQL workers
use a transaction-scoped advisory lock so only one replica executes a tick at a
time; local SQLite development runs a single process without that lock.
"""
from __future__ import annotations

import argparse
import json
import os
import signal
import threading
import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from .automation import ensure_alert, resolve_alert, tick
from .database import Base, SessionLocal, engine
from .models import WorkerHeartbeat
from .services import now_utc

WORKER_LOCK_KEY = 5_821_841_907_269_011_847
WORKER_ERROR_ALERT_KEY = "runtime:background-worker-error"
WORKER_HEARTBEAT_KEY = "office-automation"


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(value, maximum))


def worker_interval_seconds() -> int:
    return _bounded_int("KRAVIA_WORKER_INTERVAL_SECONDS", 60, 5, 3600)


def worker_batch_size() -> int:
    return _bounded_int("KRAVIA_WORKER_BATCH_SIZE", 100, 1, 500)


def _prepare_development_database() -> None:
    if os.getenv("APP_ENV", "development").strip().lower() not in {"staging", "production"}:
        Base.metadata.create_all(bind=engine)


def _try_acquire_worker_lock(db: Session) -> bool:
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return True
    acquired = db.execute(
        text("select pg_try_advisory_xact_lock(:lock_key)"),
        {"lock_key": WORKER_LOCK_KEY},
    ).scalar_one()
    return bool(acquired)


def _heartbeat(db: Session) -> WorkerHeartbeat:
    row = db.get(WorkerHeartbeat, WORKER_HEARTBEAT_KEY)
    if row is None:
        row = WorkerHeartbeat(worker_key=WORKER_HEARTBEAT_KEY, last_result_json="{}")
        db.add(row)
        db.flush()
    return row


def _record_worker_failure(error_type: str, duration_ms: int | None = None, interval_seconds: int | None = None, batch_size: int | None = None) -> None:
    """Persist a sanitized worker failure alert/heartbeat when the database is available."""
    try:
        with SessionLocal() as db:
            heartbeat = _heartbeat(db)
            heartbeat.last_started_at = now_utc()
            heartbeat.last_failed_at = now_utc()
            heartbeat.last_error_type = error_type
            heartbeat.last_duration_ms = duration_ms
            heartbeat.configured_interval_seconds = interval_seconds or worker_interval_seconds()
            heartbeat.configured_batch_size = batch_size or worker_batch_size()
            ensure_alert(
                db,
                WORKER_ERROR_ALERT_KEY,
                "AUTOMATION",
                "HIGH",
                "KRAVIA Office background worker execution failed",
                "background_worker",
                WORKER_HEARTBEAT_KEY,
                detail={"error_type": error_type},
            )
            db.commit()
    except Exception:
        # Database/network failure may be the original failure. Never hide the
        # worker process error by raising from secondary alert persistence.
        pass


def run_iteration(batch_size: int | None = None, interval_seconds: int | None = None) -> dict[str, Any]:
    batch = batch_size or worker_batch_size()
    interval = interval_seconds or worker_interval_seconds()
    started = time.monotonic()
    with SessionLocal() as db:
        if not _try_acquire_worker_lock(db):
            db.rollback()
            return {
                "status": "SKIPPED_LOCK_HELD",
                "batch_size": batch,
            }
        try:
            heartbeat = _heartbeat(db)
            heartbeat.last_started_at = now_utc()
            heartbeat.configured_interval_seconds = interval
            heartbeat.configured_batch_size = batch
            result = tick(db, limit=batch, commit=False)
            recovered = resolve_alert(db, WORKER_ERROR_ALERT_KEY)
            duration_ms = max(0, round((time.monotonic() - started) * 1000))
            response = {
                "status": "COMPLETED",
                "batch_size": batch,
                "worker_alert_recovered": recovered,
                **result,
            }
            heartbeat.last_succeeded_at = now_utc()
            heartbeat.last_error_type = None
            heartbeat.last_duration_ms = duration_ms
            heartbeat.last_result_json = json.dumps(response, sort_keys=True, default=str)
            db.commit()
            return response
        except Exception as exc:
            duration_ms = max(0, round((time.monotonic() - started) * 1000))
            db.rollback()
            _record_worker_failure(type(exc).__name__, duration_ms, interval, batch)
            raise


def _log(event: str, **detail: Any) -> None:
    payload = {"event": event, **detail}
    print(json.dumps(payload, sort_keys=True, default=str), flush=True)


def run_forever(interval_seconds: int | None = None, batch_size: int | None = None) -> int:
    interval = interval_seconds or worker_interval_seconds()
    batch = batch_size or worker_batch_size()
    stop_event = threading.Event()

    def stop(signum, _frame):
        _log("worker.stop_requested", signal=signum)
        stop_event.set()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    _log("worker.started", interval_seconds=interval, batch_size=batch)
    while not stop_event.is_set():
        started = time.monotonic()
        try:
            result = run_iteration(batch, interval)
            _log("worker.tick", result=result)
        except Exception as exc:
            _log("worker.tick_failed", error_type=type(exc).__name__)
        elapsed = time.monotonic() - started
        delay = max(0.0, interval - elapsed)
        stop_event.wait(delay)

    _log("worker.stopped")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="KRAVIA Office background worker")
    parser.add_argument("--once", action="store_true", help="Run one automation/outbox iteration and exit")
    parser.add_argument("--interval", type=int, help="Worker interval in seconds")
    parser.add_argument("--batch-size", type=int, help="Maximum outbox events per iteration")
    args = parser.parse_args()

    _prepare_development_database()
    batch = max(1, min(args.batch_size or worker_batch_size(), 500))
    if args.once:
        interval = max(5, min(args.interval or worker_interval_seconds(), 3600))
        result = run_iteration(batch, interval)
        _log("worker.once", result=result)
        return 0
    interval = max(5, min(args.interval or worker_interval_seconds(), 3600))
    return run_forever(interval, batch)


if __name__ == "__main__":
    raise SystemExit(main())
