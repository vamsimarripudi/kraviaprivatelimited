import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def production_env(**overrides):
    env = os.environ.copy()
    env.update({
        "APP_ENV": "production",
        "AUTH_MODE": "oidc",
        "OIDC_ISSUER": "https://identity.example.invalid/",
        "OIDC_AUDIENCE": "kravia-office-test",
        "OIDC_JWKS_URL": "https://identity.example.invalid/jwks.json",
        "DATABASE_URL": f"sqlite:///{Path(tempfile.mkdtemp()) / 'office.db'}",
        "DOCUMENT_STORAGE_DIR": tempfile.mkdtemp(prefix="kravia-office-production-test-"),
    })
    env.update(overrides)
    return env


def test_production_startup_rejects_missing_controlled_company_master():
    result = subprocess.run(
        [sys.executable, "-c", "import backend.main"],
        cwd=ROOT,
        env=production_env(),
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "controlled company master configuration is required" in result.stderr


def test_production_startup_accepts_configured_company_master():
    result = subprocess.run(
        [sys.executable, "-c", "import backend.main"],
        cwd=ROOT,
        env=production_env(
            KRAVIA_LEGAL_NAME="KRAVIA PRIVATE LIMITED",
            KRAVIA_CIN="TEST-CONTROLLED-CIN",
            KRAVIA_REGISTERED_OFFICE="Controlled test address",
        ),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr