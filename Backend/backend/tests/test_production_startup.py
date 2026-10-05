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


def test_startup_without_an_environment_fails_closed():
    env = os.environ.copy()
    for key in (
        "APP_ENV",
        "AUTH_MODE",
        "OFFICE_BOOTSTRAP_KEY",
        "OFFICE_AUTH_SIGNING_SECRET",
        "OFFICE_AUTH_BOOTSTRAP_SECRET",
        "OIDC_ISSUER",
        "OIDC_AUDIENCE",
        "OIDC_JWKS_URL",
        "KRAVIA_CIN",
        "KRAVIA_REGISTERED_OFFICE",
    ):
        env.pop(key, None)
    env["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp()) / 'office.db'}"
    env["DOCUMENT_STORAGE_DIR"] = tempfile.mkdtemp(prefix="kravia-office-no-env-test-")
    result = subprocess.run(
        [sys.executable, "-c", "import backend.main"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "OFFICE_AUTH_SIGNING_SECRET must be at least 32 characters" in result.stderr


def test_staging_startup_rejects_bootstrap_authentication():
    result = subprocess.run(
        [sys.executable, "-c", "import backend.main"],
        cwd=ROOT,
        env=production_env(APP_ENV="staging", AUTH_MODE="bootstrap"),
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "Bootstrap authentication is permitted only when APP_ENV=development" in result.stderr


def test_development_bootstrap_startup_requires_a_long_secret():
    env = production_env(APP_ENV="development", AUTH_MODE="bootstrap")
    env.pop("OFFICE_BOOTSTRAP_KEY", None)
    result = subprocess.run(
        [sys.executable, "-c", "import backend.main"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "OFFICE_BOOTSTRAP_KEY of at least 32 characters" in result.stderr


def test_startup_rejects_unknown_authentication_mode():
    result = subprocess.run(
        [sys.executable, "-c", "import backend.main"],
        cwd=ROOT,
        env=production_env(AUTH_MODE="unrecognised"),
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "AUTH_MODE must be bootstrap, first_party or oidc" in result.stderr
