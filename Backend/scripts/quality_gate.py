#!/usr/bin/env python3
import json, os, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = ROOT.parent
checks = []


def _quality_child_environment() -> dict[str, str]:
    """Keep static-contract and test checks hermetic and provider-free.

    Quality checks must not depend on an operator's production database,
    Brevo key, or authentication mode.  The API contract can be constructed
    with the explicit development-only bootstrap configuration below, while
    the test suite supplies its own synthetic records and credentials.
    """
    environment = os.environ.copy()
    for key in list(environment):
        if key in {"DATABASE_URL", "BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME", "BREVO_API_TIMEOUT_SECONDS", "DOCUMENT_STORAGE_DIR", "KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET"}:
            environment.pop(key, None)
        elif key.startswith("OFFICE_AUTH_") or key.startswith("OFFICE_EMAIL_OTP_"):
            environment.pop(key, None)
    environment.update(
        {
            "APP_ENV": "development",
            "AUTH_MODE": "bootstrap",
            "OFFICE_BOOTSTRAP_KEY": "test-office-bootstrap-key-for-fastapi-suite-0001",
        }
    )
    return environment


def check(name, ok, detail):
    checks.append({"name": name, "status": "PASS" if ok else "FAIL", "detail": detail})


required = [
    "index.html", "styles.css", "data.js", "engine.js", "app.js",
    "web/index.html", "web/app.css", "web/app.js",
    "web/finance.html", "web/finance.css", "web/finance.js",
    "web/auth.html", "web/auth.css", "web/auth.js",
    "backend/main.py", "backend/app.py", "backend/models.py", "backend/email_delivery.py", "backend/email_templates.py", "backend/generated_email_templates.json", "backend/public_intake_email.py",
    "backend/finance_models.py", "backend/finance_ownership.py",
    "backend/identity_auth.py", "backend/period_controls.py", "backend/security_controls.py", "backend/drive_integration.py",
    "scripts/export_openapi.py", "spec/api/openapi.json",
    "spec/security/PRODUCTION_GATES.md", "spec/deployment/DEPLOYMENT_PLAN.md",
    "FINANCE_OWNERSHIP.md",
]
for f in required:
    check(f"required:{f}", (ROOT / f).exists(), f)

for f in ["data.js", "engine.js", "app.js", "web/app.js", "web/finance.js", "web/auth.js"]:
    r = subprocess.run(["node", "--check", str(ROOT / f)], capture_output=True, text=True)
    check(f"js-syntax:{f}", r.returncode == 0, (r.stderr or "syntax ok").strip())

r = subprocess.run([sys.executable, "-m", "compileall", "-q", str(ROOT / "backend")], capture_output=True, text=True)
check("python-compile", r.returncode == 0, (r.stderr or "compile ok").strip())

pytest_runtime_root = ROOT / "runtime" / "quality-pytest"
pytest_runtime_root.mkdir(parents=True, exist_ok=True)
# The Windows sandbox can leave the account-wide pytest temp root unreadable.
# Give pytest a unique, gitignored base path which it creates itself instead.
pytest_base = pytest_runtime_root / f"run-{uuid4().hex}"
r = subprocess.run(
    [sys.executable, "scripts/export_openapi.py", "--check"],
    cwd=ROOT,
    capture_output=True,
    text=True,
    env=_quality_child_environment(),
)
check("openapi-drift", r.returncode == 0, (r.stdout + r.stderr).strip()[-1200:] or "OpenAPI check completed")

try:
    openapi = json.loads((ROOT / "spec" / "api" / "openapi.json").read_text(encoding="utf-8"))
    paths = openapi.get("paths", {})
    check("openapi:period-locks", "/api/v1/accounting/period-locks" in paths, "period-lock contract")
    check("openapi:drive-readiness", "/api/v1/integrations/google-drive/evidence-readiness" in paths, "Drive evidence-readiness contract")
    check("openapi:identity-readiness", "/api/v1/auth/readiness" in paths, "identity readiness contract")
    check("openapi:mfa-verify", "/api/v1/auth/mfa/verify" in paths, "MFA verification contract")
    check("openapi:authenticator-activation", "/api/v1/auth/authenticator/activation-requests" in paths, "approved phone activation contract")
    check("openapi:email-otp", "/api/v1/auth/email-otp/challenges" in paths and "/api/v1/auth/email-otp/challenges/{challenge_id}/verify" in paths, "credential-first mobile email verification contract")
    check("openapi:public-form-email", "/api/v1/public-intake/email-acknowledgements" in paths, "signed public-form acknowledgement contract")
    check("openapi:public-follow-up-email", "/api/v1/public-intake/email-follow-ups" in paths, "signed Office follow-up contract")
    check("openapi:first-party-sessions", "/api/v1/auth/sessions" in paths and "/api/v1/auth/sessions/{session_id}/revoke" in paths, "first-party session inventory/revocation contract")
    check("openapi:device-event", "/api/v1/auth/device-event" in paths, "first-party trusted-device event contract")
    check("openapi:password-change", "/api/v1/auth/password" in paths, "AAL2 password-change contract")
    check("openapi:password-recovery", "/api/v1/auth/recovery/password" in paths and "/api/v1/auth/users/{user_id}/recovery-link" in paths, "single-use administrator recovery contract")
    check("openapi:founder-break-glass", "/api/v1/auth/founder/recovery-link" in paths, "Founder break-glass recovery contract")
except (OSError, ValueError) as exc:
    check("openapi:parse", False, str(exc))

r = subprocess.run(
    [
        sys.executable,
        "-m",
        "pytest",
        "-p",
        "no:cacheprovider",
        "--basetemp",
        str(pytest_base),
        "backend/tests",
        "-q",
    ],
    cwd=ROOT,
    capture_output=True,
    text=True,
    env=_quality_child_environment(),
)
check("api-tests", r.returncode == 0, (r.stdout + r.stderr).strip()[-2200:])

kos = (ROOT / "README.md").read_text(errors="ignore") + (ROOT / "SOURCE_EVIDENCE.md").read_text(errors="ignore")
check("no-fake-data-policy", "fake" in kos.lower() or "fabricat" in kos.lower(), "policy found in docs")
status = (ROOT / "IMPLEMENTATION_STATUS.md").read_text(errors="ignore")
check(
    "production-blocker-disclosure",
    ("production-ready" in status.lower() or "production activation" in status.lower() or "external production gates" in status.lower())
    and ("do not" in status.lower() or "not describe" in status.lower()),
    "release rule present",
)

main = (ROOT / "backend" / "main.py").read_text(errors="ignore")
models = (ROOT / "backend" / "models.py").read_text(errors="ignore")
finance = (ROOT / "backend" / "finance_ownership.py").read_text(errors="ignore")
finance_models = (ROOT / "backend" / "finance_models.py").read_text(errors="ignore")
identity = (ROOT / "backend" / "identity_auth.py").read_text(errors="ignore")
period_controls = (ROOT / "backend" / "period_controls.py").read_text(errors="ignore")
security_controls = (ROOT / "backend" / "security_controls.py").read_text(errors="ignore")
drive = (ROOT / "backend" / "drive_integration.py").read_text(errors="ignore")
services = (ROOT / "backend" / "services.py").read_text(errors="ignore")
app = (ROOT / "backend" / "app.py").read_text(errors="ignore")

for token in ["credit-notes", "refunds", "commercial/plans", "banking/transactions", "approvals", "notices", "inspections", "integrations", "command-center"]:
    check(f"v2-api:{token}", token in main, token)
for token in ["CreditNote", "Refund", "CommercialPlan", "Subscription", "BankTransaction", "ApprovalRequest", "NoticeCase", "InspectionCase"]:
    check(f"v2-model:{token}", f"class {token}" in models, token)
for token in ["ownership/summary", "ownership/transfers", "finance/funding-policies", "finance/expenses", "finance/mandates", "finance/payment-instructions", "finance/webhooks/razorpay"]:
    check(f"finance-ownership-api:{token}", token in finance, token)
for token in ["ShareLedgerEntry", "ShareTransferRequest", "FundingPolicy", "ExpenseObligation", "PaymentMandate", "ContributionCall", "PaymentInstruction", "FinanceProviderEvent"]:
    check(f"finance-ownership-model:{token}", f"class {token}" in finance_models, token)

check("identity:first-party-core", "PASSWORD_HASHER = PasswordHasher" in identity and "refresh_token_hash" in identity and "KRAVIA_FIRST_PARTY" in identity, "KRAVIA-owned password and session authority")
check("identity:founder-bootstrap", "Founder registration is permanently closed" in identity and "X-Kravia-Bootstrap-Key" in identity and "FOUNDER_SLOT" in identity, "one-time protected Founder bootstrap")
check(
    "identity:mfa",
    "pyotp.TOTP" in identity
    and "_encrypt_mfa_secret" in identity
    and "_claim_mfa_counter" in identity
    and 'OfficeAuthSession.aal == "aal1"' in identity
    and 'aal="aal2"' in identity,
    "first-party encrypted TOTP MFA promotion",
)
check("identity:role-claim", "office_roles" in identity, "Office role claim")
check("identity:cookie-bridge", "kravia_office_access" in security_controls and "_inject_bearer" in security_controls, "HttpOnly cookie to verified Bearer bridge")
check("identity:aal2-gate", "OFFICE_REQUIRED_AAL" in security_controls and "MFA verification required" in security_controls, "AAL2 production gate")
check("identity:attached", "build_identity_router" in app, "identity router attached to canonical app")
check("public-intake:attached", "build_public_intake_email_router" in app, "signed public-form acknowledgement router attached")
check("public-intake:follow-up", '"/email-follow-ups"' in (ROOT / "backend" / "public_intake_email.py").read_text(errors="ignore"), "persisted Office follow-up delivery route")
email_manifest = (ROOT / "backend" / "generated_email_templates.json").read_text(errors="ignore")
check(
    "email:react-template-manifest",
    '"format": 1' in email_manifest
    and '"office_sign_in_code"' in email_manifest
    and '"public_request_received"' in email_manifest
    and '"public_request_update"' in email_manifest
    and '"public_welcome"' in email_manifest
    and "@@KRAVIA_CODE@@" in email_manifest,
    "React Email generated server manifest",
)
check("identity:session-management", '@router.get("/sessions")' in identity and '@router.post("/sessions/{session_id}/revoke")' in identity, "first-party session inventory and revocation")
check("identity:device-events", '@router.post("/device-event")' in identity and "DEVICE_UNLINKED" in identity, "first-party trusted-device event audit")
check("identity:password-change", '@router.post("/password")' in identity and "PASSWORD_CHANGED" in identity, "AAL2 password rotation")
check("identity:private-recovery", '@router.post("/recovery/password")' in identity and '@router.post("/users/{user_id}/recovery-link")' in identity and "PASSWORD_RECOVERY_COMPLETED" in identity, "provider-free single-use recovery")
check("identity:founder-break-glass", '@router.post("/founder/recovery-link")' in identity and "OFFICE_AUTH_BREAK_GLASS_SECRET" in identity and "FOUNDER_BREAK_GLASS_RECOVERY_ISSUED" in identity, "separate Founder emergency recovery")
check(
    "identity:mfa-replay-protection",
    "mfa_last_accepted_counter" in identity
    and "MFA_REPLAY_BLOCKED" in identity
    and "_matching_totp_counter" in identity
    and "_claim_mfa_counter" in identity
    and "update(OfficeAuthUser)" in identity,
    "TOTP counters are atomically accepted once per user",
)
check("identity:mfa-attempt-cap", "MFA_MAX_FAILED_ATTEMPTS" in identity and "MFA_SESSION_REVOKED" in identity and "mfa_failed_attempts" in identity, "AAL1 session revoked after repeated invalid OTPs")
check("identity:authenticator-activation", '@router.post("/authenticator/activation-requests")' in identity and "AUTHENTICATOR_ACTIVATION_APPROVED" in identity and "OfficeAuthenticatorActivation" in identity, "AAL2-governed phone activation")
check(
    "identity:email-otp",
    '@router.post("/email-otp/challenges", status_code=201)' in identity
    and '@router.post("/email-otp/challenges/{challenge_id}/verify")' in identity
    and "OfficeEmailOtpChallenge" in identity
    and "send_office_email_verification_code" in identity
    and "EMAIL_OTP_MOBILE_REFRESH_TTL_SECONDS" in identity,
    "credential-first email OTP with a fixed mobile session lifetime",
)
check(
    "identity:kravia-authenticator",
    'MFA_AUTHENTICATOR_APP = "Authenticator"' in identity
    and '"mfa_required_for_all_roles": True' in identity
    and 'MFA_ISSUER = "KRAVIA Office"' in identity
    and "MFA_DIGITS = 6" in identity
    and "MFA_PERIOD_SECONDS = 30" in identity,
    "dedicated Authenticator is the all-role TOTP factor",
)

check("period-control:model", "class AccountingPeriodLock" in period_controls, "AccountingPeriodLock")
check("period-control:api", "accounting/period-locks" in period_controls, "period-lock endpoints")
check("period-control:maker-checker", "ACCOUNTING_PERIOD_UNLOCK" in period_controls and "ApprovalRequest" in period_controls, "controlled reopen approval")
check("period-control:journal-enforcement", "assert_period_open" in services and '"TAX"' in services and '"ACCOUNTING"' in services, "central posting enforcement")
check("security:csp", "Content-Security-Policy" in security_controls, "CSP header")
check("security:rate-limit", "FixedWindowRateLimiter" in security_controls and "429" in security_controls, "mutation rate limit")
check("security:origin-guard", "Cross-origin mutation is not allowed" in security_controls, "browser origin guard")
check("security:attached", "configure_security(app)" in app, "canonical app middleware")
check("drive:evidence-readiness", "evidence-readiness" in drive and "EXPECTED_EVIDENCE_AREAS" in drive, "taxonomy readiness endpoint")
check("drive:metadata-only", "content_downloaded" in drive and "write_enabled" in drive, "read-only evidence boundary")

migration_dir = ROOT / "backend" / "migrations" / "versions"
finance_migrations = list(migration_dir.glob("*_v4_finance_ownership_treasury.py"))
period_migrations = list(migration_dir.glob("*_v5_period_close_controls.py"))
v11_migrations = list(migration_dir.glob("*_v11_product_tax_profiles.py"))
v12_migrations = list(migration_dir.glob("*_v12_gst_irp_integration.py"))
v13_migrations = list(migration_dir.glob("*_v13_gst_purchase_reconciliation.py"))
v14_migrations = list(migration_dir.glob("*_v14_fynamics_gsp_filing.py"))
v15_migrations = list(migration_dir.glob("*_v15_mfa_replay_protection.py"))
v16_migrations = list(migration_dir.glob("*_v16_authenticator_device_approval.py"))
v17_migrations = list(migration_dir.glob("*_v17_email_otp_challenges.py"))
v18_migrations = list(migration_dir.glob("*_v18_public_form_email_deliveries.py"))
v19_migrations = list(migration_dir.glob("*_v19_public_intake_follow_up_deliveries.py"))
check("finance-ownership-migration", len(finance_migrations) == 1, finance_migrations[0].name if len(finance_migrations) == 1 else f"found {len(finance_migrations)}")
check("period-control-migration", len(period_migrations) == 1, period_migrations[0].name if len(period_migrations) == 1 else f"found {len(period_migrations)}")
check("gst:v11-tax-profile-migration", len(v11_migrations) == 1, v11_migrations[0].name if len(v11_migrations) == 1 else f"found {len(v11_migrations)}")
check("gst:v12-irp-migration", len(v12_migrations) == 1, v12_migrations[0].name if len(v12_migrations) == 1 else f"found {len(v12_migrations)}")
check("gst:v13-purchase-reconciliation-migration", len(v13_migrations) == 1, v13_migrations[0].name if len(v13_migrations) == 1 else f"found {len(v13_migrations)}")
check("gst:v14-gsp-filing-migration", len(v14_migrations) == 1, v14_migrations[0].name if len(v14_migrations) == 1 else f"found {len(v14_migrations)}")
check("identity:v15-mfa-replay-migration", len(v15_migrations) == 1, v15_migrations[0].name if len(v15_migrations) == 1 else f"found {len(v15_migrations)}")
check("identity:v16-authenticator-activation-migration", len(v16_migrations) == 1, v16_migrations[0].name if len(v16_migrations) == 1 else f"found {len(v16_migrations)}")
check("identity:v17-email-otp-migration", len(v17_migrations) == 1, v17_migrations[0].name if len(v17_migrations) == 1 else f"found {len(v17_migrations)}")
check("public-intake:v18-email-delivery-migration", len(v18_migrations) == 1, v18_migrations[0].name if len(v18_migrations) == 1 else f"found {len(v18_migrations)}")
check("public-intake:v19-follow-up-delivery-migration", len(v19_migrations) == 1, v19_migrations[0].name if len(v19_migrations) == 1 else f"found {len(v19_migrations)}")

broker = REPO_ROOT / "Database" / "supabase" / "functions" / "kravia-storage-broker" / "index.ts"
broker_source = broker.read_text(errors="ignore") if broker.exists() else ""
storage_client = (ROOT / "backend" / "storage_broker_client.py").read_text(errors="ignore")
file_security = (ROOT / "backend" / "file_security.py").read_text(errors="ignore")
check("storage:broker-versioned", broker.exists() and "x-kravia-signature" in broker_source and "office-quarantine" in broker_source, str(broker.relative_to(REPO_ROOT)) if broker.exists() else "storage broker source missing")
check("storage:signed-client", "KRAVIA_STORAGE_BROKER_PRIVATE_KEY" in storage_client and "signed_upload" in storage_client and "signed_download" in storage_client, "signed storage-broker client")
check("storage:quarantine-scan", "office-quarantine" in file_security and "scan_bytes" in file_security and "CLAMAV_HOST" in file_security, "private quarantine + ClamAV scan pipeline")
check("storage:signed-document-quarantine", "DOCUMENT_SIGNATURE" in file_security and "_finalize_clean_context" in file_security and "office_document_record_signature" in file_security, "signed documents finalize only from clean quarantine workflow")

summary = {
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "result": "PASS" if all(c["status"] == "PASS" for c in checks) else "FAIL",
    "checks": checks,
}
path = ROOT / "generated" / "QUALITY_GATE_REPORT.json"
path.parent.mkdir(exist_ok=True)
path.write_text(json.dumps(summary, indent=2))
print(json.dumps(summary, indent=2))
sys.exit(0 if summary["result"] == "PASS" else 1)
