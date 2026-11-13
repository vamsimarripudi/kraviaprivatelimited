"""Invitation notice opt-in, security and idempotence in isolated SQLite.

These tests do not call an SMTP provider or touch any real employee.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.auth_models import (
    OfficeAuthUser, OfficeAuthInvite, OfficeInvitationNoticeDelivery,
)
from backend import office_invitation_notice_worker as notice


def _setup(monkeypatch, *, expires_in_hours: int = 12, opt_in: bool = True):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(notice, "SessionLocal", sessions)
    now = datetime.now(timezone.utc)
    with sessions() as db:
        db.add(OfficeAuthUser(
            id="b1000000-0000-4000-8000-000000000001",
            email="owner@kraviaprivatelimited.com", display_name="Owner",
            password_hash="synthetic", status="ACTIVE",
        ))
        db.add(OfficeAuthInvite(
            id="b1000000-0000-4000-8000-000000000002",
            token_hash="f" * 64, email="invitee@kraviaprivatelimited.com",
            display_name="New Colleague", roles_json='["MEMBER"]',
            status="PENDING", created_by="b1000000-0000-4000-8000-000000000001",
            created_at=now - timedelta(days=1),
            expires_at=now + timedelta(hours=expires_in_hours),
            notice_opt_in=opt_in,
        ))
        db.commit()
    return engine, sessions


def _rows(sessions):
    with sessions() as db:
        return db.execute(
            select(OfficeInvitationNoticeDelivery)
            .order_by(OfficeInvitationNoticeDelivery.kind,
                      OfficeInvitationNoticeDelivery.recipient_kind)
        ).scalars().all()


def test_disabled_worker_never_sends_or_mutates_invites(monkeypatch):
    engine, sessions = _setup(monkeypatch)
    monkeypatch.setenv("KRAVIA_INVITATION_NOTICES_ENABLED", "false")
    sent = []
    monkeypatch.setattr(notice, "send_office_invitation_status_notice",
                        lambda **kwargs: sent.append(kwargs))
    try:
        assert notice.process_invitation_notices() == {"status": "DISABLED", "claimed": 0}
        assert _rows(sessions) == []
        assert not sent
    finally:
        engine.dispose()


def test_owner_opt_in_is_required_and_template_contains_no_old_token(monkeypatch):
    engine, sessions = _setup(monkeypatch, opt_in=False)
    monkeypatch.setenv("KRAVIA_INVITATION_NOTICES_ENABLED", "true")
    sent = []
    monkeypatch.setattr(notice, "send_office_invitation_status_notice",
                        lambda **kwargs: sent.append(kwargs) or "brevo-confirmed")
    try:
        assert notice.process_invitation_notices()["claimed"] == 0
        with sessions() as db:
            invite = db.get(OfficeAuthInvite,"b1000000-0000-4000-8000-000000000002")
            invite.notice_opt_in = True
            db.commit()
        assert notice.process_invitation_notices()["accepted"] == 1
        assert len(sent) == 1
        assert sent[0]["kind"] == "REMINDER"
        assert sent[0]["recipient_kind"] == "INVITEE"
        assert "token" not in sent[0]
        assert notice.process_invitation_notices()["claimed"] == 0
        assert len(_rows(sessions)) == 1
    finally:
        engine.dispose()


def test_expired_invitation_notifies_invitee_and_active_inviter_exactly_once(monkeypatch):
    engine, sessions = _setup(monkeypatch, expires_in_hours=-2)
    monkeypatch.setenv("KRAVIA_INVITATION_NOTICES_ENABLED", "true")
    sent = []
    monkeypatch.setattr(notice,"send_office_invitation_status_notice",
                        lambda **kwargs: sent.append(kwargs) or "brevo-confirmed")
    try:
        first = notice.process_invitation_notices(limit=2)
        assert first["accepted"] == 2
        assert {x["recipient_kind"] for x in sent} == {"INVITEE", "INVITER"}
        assert {x["kind"] for x in sent} == {"EXPIRED"}
        with sessions() as db:
            invite = db.get(OfficeAuthInvite,"b1000000-0000-4000-8000-000000000002")
            assert invite.status == "EXPIRED"
        assert notice.process_invitation_notices()["claimed"] == 0
    finally:
        engine.dispose()


def test_provider_unknown_is_quarantined_and_not_resent(monkeypatch):
    engine, sessions = _setup(monkeypatch)
    monkeypatch.setenv("KRAVIA_INVITATION_NOTICES_ENABLED", "true")
    calls = []
    def unknown(**kwargs):
        calls.append(kwargs)
        raise notice.EmailDeliveryUnknown("Unknown provider acknowledgement")
    monkeypatch.setattr(notice,"send_office_invitation_status_notice",unknown)
    try:
        first = notice.process_invitation_notices()
        assert first["unknown"] == 1
        assert _rows(sessions)[0].status == "UNKNOWN"
        assert notice.process_invitation_notices()["claimed"] == 0
        assert len(calls) == 1
    finally:
        engine.dispose()


def test_stale_claim_is_marked_unknown_without_duplicate_submission(monkeypatch):
    engine, sessions = _setup(monkeypatch)
    monkeypatch.setenv("KRAVIA_INVITATION_NOTICES_ENABLED","true")
    with sessions() as db:
        db.add(OfficeInvitationNoticeDelivery(
            id="b2000000-0000-4000-8000-000000000003",
            invite_id="b1000000-0000-4000-8000-000000000002",
            kind="REMINDER",recipient_kind="INVITEE",
            recipient_email="invitee@kraviaprivatelimited.com",
            recipient_name="New Colleague",status="SENDING",
            claim_token="b3000000-0000-4000-8000-000000000003",
            claimed_at=datetime.now(timezone.utc)-timedelta(minutes=40),
        ))
        db.commit()
    sent = []
    monkeypatch.setattr(notice,"send_office_invitation_status_notice",
                        lambda **kwargs: sent.append(kwargs))
    try:
        assert notice.process_invitation_notices()["claimed"] == 0
        assert _rows(sessions)[0].status == "UNKNOWN"
        assert not sent
    finally:
        engine.dispose()


def test_reissued_invitation_suppresses_expired_previous_notice(monkeypatch):
    engine, sessions = _setup(monkeypatch,expires_in_hours=-1)
    monkeypatch.setenv("KRAVIA_INVITATION_NOTICES_ENABLED","true")
    sent = []
    monkeypatch.setattr(notice,"send_office_invitation_status_notice",
                        lambda **kwargs: sent.append(kwargs) or "brevo")
    try:
        with sessions() as db:
            original = db.get(OfficeAuthInvite,"b1000000-0000-4000-8000-000000000002")
            db.add(OfficeAuthInvite(
                id="b1000000-0000-4000-8000-000000000004",
                token_hash="e"*64,email=original.email,display_name=original.display_name,
                roles_json=original.roles_json,status="PENDING",created_by=original.created_by,
                created_at=datetime.now(timezone.utc),
                expires_at=datetime.now(timezone.utc)+timedelta(days=2),
                notice_opt_in=False,
            ))
            db.commit()
        assert notice.process_invitation_notices()["claimed"] == 0
        assert not sent
    finally:
        engine.dispose()
