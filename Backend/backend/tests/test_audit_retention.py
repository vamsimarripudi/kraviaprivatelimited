from datetime import timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.audit_retention import _held, _manifest_digest
from backend.models import AuditEvent, AuditLegalHold, AuditRetentionPolicy
from backend.services import now_utc


def _session(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'audit-retention.db'}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    return engine, sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def test_legal_hold_scopes_protect_matching_audit_events(tmp_path):
    engine, factory = _session(tmp_path)
    try:
        with factory() as db:
            event = AuditEvent(
                id="AUD-HOLD",
                occurred_at=now_utc() - timedelta(days=365),
                actor="auditor@example.com",
                actor_role="AUDITOR",
                event_type="ownership.share_change.posted",
                entity_type="share_change",
                entity_id="SCR-1",
                correlation_id="COR-1",
                detail_json="{}",
                severity="CONTROL",
                previous_hash=None,
                event_hash="a" * 64,
            )
            db.add(event)
            db.commit()
            holds = [
                AuditLegalHold(id="AHL-ENTITY", scope_type="ENTITY", scope_value="share_change:SCR-1", reason="case", status="ACTIVE", created_by="owner"),
                AuditLegalHold(id="AHL-ACTOR", scope_type="ACTOR", scope_value="auditor@example.com", reason="case", status="ACTIVE", created_by="owner"),
                AuditLegalHold(id="AHL-CORR", scope_type="CORRELATION", scope_value="COR-1", reason="case", status="ACTIVE", created_by="owner"),
                AuditLegalHold(id="AHL-EVENT", scope_type="EVENT_TYPE", scope_value="ownership.share_change.posted", reason="case", status="ACTIVE", created_by="owner"),
            ]
            for hold in holds:
                assert _held(event, [hold]) is True
    finally:
        engine.dispose()


def test_archive_manifest_hash_is_deterministic_and_chain_bound(tmp_path):
    engine, factory = _session(tmp_path)
    try:
        with factory() as db:
            policy = AuditRetentionPolicy(
                id="ARP-1",
                name="Reviewed policy",
                retention_days=365,
                status="ACTIVE",
                created_by="owner",
            )
            first = AuditEvent(
                id="AUD-1",
                occurred_at=now_utc() - timedelta(days=800),
                actor="owner",
                actor_role="OWNER",
                event_type="test.one",
                entity_type="test",
                entity_id="1",
                correlation_id=None,
                detail_json="{}",
                severity="CONTROL",
                previous_hash=None,
                event_hash="1" * 64,
            )
            second = AuditEvent(
                id="AUD-2",
                occurred_at=now_utc() - timedelta(days=700),
                actor="owner",
                actor_role="OWNER",
                event_type="test.two",
                entity_type="test",
                entity_id="2",
                correlation_id=None,
                detail_json="{}",
                severity="CONTROL",
                previous_hash=first.event_hash,
                event_hash="2" * 64,
            )
            cutoff = now_utc() - timedelta(days=365)
            one = _manifest_digest(policy, cutoff, [first, second])
            two = _manifest_digest(policy, cutoff, [first, second])
            reversed_digest = _manifest_digest(policy, cutoff, [second, first])
            assert one == two
            assert len(one) == 64
            assert one != reversed_digest
    finally:
        engine.dispose()


def test_retention_router_exposes_no_destructive_purge_endpoint():
    source = __import__("inspect").getsource(__import__("backend.audit_retention", fromlist=["build_audit_retention_router"]))
    assert '"/archive-manifests"' in source
    assert '"/holds"' in source
    assert '"/policies"' in source
    assert 'purge_supported' in source
    assert 'delete(' not in source.lower()
