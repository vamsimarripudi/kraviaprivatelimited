from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_static_seed_excludes_controlled_evidence_and_provider_snapshots():
    seed = (ROOT / "data.js").read_text(encoding="utf-8")
    assert "CONTROLLED_NOT_EMBEDDED" in seed
    assert "INGESTED_SNAPSHOT" not in seed
    assert "Current Account / Biz Pro+" not in seed
    assert "CKYC" not in seed
    assert "Razorpay" not in seed
    assert "Amazon Web Services" not in seed
    assert "Protean" not in seed