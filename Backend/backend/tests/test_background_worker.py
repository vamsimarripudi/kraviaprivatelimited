from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import DomainEvent, OperationalAlert, WorkerHeartbeat
import backend.worker as worker


@pytest.fixture()
def worker_db(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'worker-test.db'}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    monkeypatch.setattr(worker, "SessionLocal", session_factory)
    try:
        yield session_factory
    finally:
        engine.dispose()


def test_worker_processes_bounded_outbox_and_records_heartbeat(worker_db):
    now = datetime.now(timezone.utc)
    with worker_db() as db:
        db.add_all([
            DomainEvent(
                id="EVT-WORKER-KNOWN",
                event_type="invoice.issued",
                aggregate_type="invoice",
                aggregate_id="INV-WORKER",
                payload_json="{}",
                status="PENDING",
                attempts=0,
                created_at=now - timedelta(seconds=2),
            ),
            DomainEvent(
                id="EVT-WORKER-UNKNOWN",
                event_type="external.unsupported",
                aggregate_type="external",
                aggregate_id="EXT-WORKER",
                payload_json="{}",
                status="PENDING",
                attempts=0,
                created_at=now - timedelta(seconds=1),
            ),
        ])
        db.commit()

    first = worker.run_iteration(batch_size=1, interval_seconds=300)
    assert first["status"] == "COMPLETED"
    assert first["outbox"]["examined"] == 1
    assert first["outbox"]["processed"] == 1

    with worker_db() as db:
        known = db.get(DomainEvent, "EVT-WORKER-KNOWN")
        unknown = db.get(DomainEvent, "EVT-WORKER-UNKNOWN")
        heartbeat = db.get(WorkerHeartbeat, worker.WORKER_HEARTBEAT_KEY)
        assert known.status == "PROCESSED"
        assert unknown.status == "PENDING"
        assert heartbeat is not None
        assert heartbeat.last_succeeded_at is not None
        assert heartbeat.last_error_type is None
        assert heartbeat.last_duration_ms is not None
        assert heartbeat.configured_interval_seconds == 300
        assert heartbeat.configured_batch_size == 1

    second = worker.run_iteration(batch_size=1, interval_seconds=300)
    assert second["outbox"]["waiting_handler"] == 1
    with worker_db() as db:
        assert db.get(DomainEvent, "EVT-WORKER-UNKNOWN").status == "WAITING_HANDLER"


def test_worker_skips_when_distributed_lock_is_held(worker_db, monkeypatch):
    monkeypatch.setattr(worker, "_try_acquire_worker_lock", lambda _db: False)
    result = worker.run_iteration(batch_size=25)
    assert result == {"status": "SKIPPED_LOCK_HELD", "batch_size": 25}


def test_worker_failure_records_sanitized_alert_and_heartbeat(worker_db, monkeypatch):
    def fail_tick(*_args, **_kwargs):
        raise RuntimeError("sensitive provider detail must not be stored")

    monkeypatch.setattr(worker, "tick", fail_tick)
    with pytest.raises(RuntimeError):
        worker.run_iteration(batch_size=5, interval_seconds=600)

    with worker_db() as db:
        heartbeat = db.get(WorkerHeartbeat, worker.WORKER_HEARTBEAT_KEY)
        alert = db.execute(
            select(OperationalAlert).where(OperationalAlert.alert_key == worker.WORKER_ERROR_ALERT_KEY)
        ).scalar_one()
        assert heartbeat.last_failed_at is not None
        assert heartbeat.last_error_type == "RuntimeError"
        assert heartbeat.configured_interval_seconds == 600
        assert heartbeat.configured_batch_size == 5
        assert "sensitive provider detail" not in heartbeat.last_result_json
        assert alert.status == "OPEN"
        assert "RuntimeError" in alert.detail_json
        assert "sensitive provider detail" not in alert.detail_json


def test_clamav_startup_self_test_defaults_on_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("KRAVIA_CLAMAV_SELF_TEST_ON_STARTUP", raising=False)
    monkeypatch.setattr(
        worker,
        "clamav_eicar_self_test",
        lambda: {
            "status": "PASSED",
            "scanner": "CLAMAV",
            "scanner_version": "ClamAV 1.5.4",
            "threat": "Win.Test.EICAR_HDB-1",
        },
    )
    result = worker.run_clamav_startup_self_test()
    assert result["status"] == "PASSED"
    assert result["attempt"] == 1


def test_clamav_startup_self_test_skips_by_default_outside_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("KRAVIA_CLAMAV_SELF_TEST_ON_STARTUP", raising=False)
    assert worker.run_clamav_startup_self_test() == {"status": "SKIPPED"}


def test_clamav_startup_self_test_fails_closed_after_retries(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("KRAVIA_CLAMAV_SELF_TEST_ATTEMPTS", "2")
    monkeypatch.setenv("KRAVIA_CLAMAV_SELF_TEST_RETRY_SECONDS", "0")
    monkeypatch.setattr(
        worker,
        "clamav_eicar_self_test",
        lambda: (_ for _ in ()).throw(RuntimeError("scanner unavailable")),
    )
    with pytest.raises(RuntimeError, match="failed after 2 attempts"):
        worker.run_clamav_startup_self_test()


def test_private_file_pipeline_startup_self_test_defaults_on_in_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("KRAVIA_FILE_PIPELINE_SELF_TEST_ON_STARTUP", raising=False)
    monkeypatch.setattr(
        worker,
        "private_file_pipeline_self_test",
        lambda: {
            "status": "PASSED",
            "quarantine_bucket": "office-quarantine",
            "release_bucket": "office-documents",
            "clean_scan": True,
        },
    )
    result = worker.run_file_pipeline_startup_self_test()
    assert result["status"] == "PASSED"
    assert result["attempt"] == 1


def test_private_file_pipeline_startup_self_test_skips_outside_production(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("KRAVIA_FILE_PIPELINE_SELF_TEST_ON_STARTUP", raising=False)
    assert worker.run_file_pipeline_startup_self_test() == {"status": "SKIPPED"}
