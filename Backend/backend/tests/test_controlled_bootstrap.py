import os
import tempfile

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("AUTH_MODE", "bootstrap")

from backend.controlled_bootstrap import apply_controlled_config, validate_controlled_config
from backend.database import Base
from backend.finance_models import ShareLedgerEntry, Shareholder


def sample_config():
    return {
        "legal_entity": {
            "legal_name": "KRAVIA PRIVATE LIMITED",
            "cin": "U00000AP2026PTC000001",
            "registered_office": "Controlled test office",
            "state_code": "37",
            "source_ref": "test:company-master",
        },
        "share_classes": [
            {
                "code": "EQ",
                "name": "Equity Shares",
                "face_value": "10.00",
                "authorised_shares": 10000,
                "voting_rights_per_share": 1,
                "evidence_ref": "test:class",
            }
        ],
        "shareholders": [
            {"shareholder_no": "SH-001", "legal_name": "Holder One", "evidence_ref": "test:h1"},
            {"shareholder_no": "SH-002", "legal_name": "Holder Two", "evidence_ref": "test:h2"},
        ],
        "initial_allocations": [
            {"shareholder_no": "SH-001", "share_class_code": "EQ", "quantity": 8000, "instrument_date": "2026-07-01", "evidence_ref": "test:a1"},
            {"shareholder_no": "SH-002", "share_class_code": "EQ", "quantity": 2000, "instrument_date": "2026-07-01", "evidence_ref": "test:a2"},
        ],
    }


def test_controlled_bootstrap_validation_blocks_over_allocation():
    cfg = sample_config()
    cfg["initial_allocations"][1]["quantity"] = 3000
    try:
        validate_controlled_config(cfg)
    except ValueError as exc:
        assert "exceeds authorised shares" in str(exc)
    else:
        raise AssertionError("over-allocation must be rejected")


def test_controlled_bootstrap_is_idempotent():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    os.unlink(path)
    engine = create_engine(f"sqlite:///{path}")
    Session = sessionmaker(bind=engine, future=True)
    Base.metadata.create_all(engine)
    try:
        with Session() as db:
            first = apply_controlled_config(db, sample_config(), actor="Bootstrap Test")
            second = apply_controlled_config(db, sample_config(), actor="Bootstrap Test")
            assert first["allocations_posted"] == 2
            assert second["allocations_posted"] == 0
            assert second["allocations_skipped"] == 2
            assert db.scalar(select(func.count()).select_from(Shareholder)) == 2
            assert db.scalar(select(func.count()).select_from(ShareLedgerEntry)) == 2
    finally:
        engine.dispose()
        if os.path.exists(path):
            os.unlink(path)
