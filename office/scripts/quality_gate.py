#!/usr/bin/env python3
import json, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checks = []


def check(name, ok, detail):
    checks.append({"name": name, "status": "PASS" if ok else "FAIL", "detail": detail})


required = [
    "index.html", "styles.css", "data.js", "engine.js", "app.js",
    "web/index.html", "web/app.css", "web/app.js",
    "web/finance.html", "web/finance.css", "web/finance.js",
    "backend/main.py", "backend/app.py", "backend/models.py",
    "backend/finance_models.py", "backend/finance_ownership.py",
    "backend/period_controls.py", "backend/security_controls.py", "backend/drive_integration.py",
    "scripts/export_openapi.py", "spec/api/openapi.json",
    "spec/security/PRODUCTION_GATES.md", "spec/deployment/DEPLOYMENT_PLAN.md",
    "FINANCE_OWNERSHIP.md",
]
for f in required:
    check(f"required:{f}", (ROOT / f).exists(), f)

for f in ["data.js", "engine.js", "app.js", "web/app.js", "web/finance.js"]:
    r = subprocess.run(["node", "--check", str(ROOT / f)], capture_output=True, text=True)
    check(f"js-syntax:{f}", r.returncode == 0, (r.stderr or "syntax ok").strip())

r = subprocess.run([sys.executable, "-m", "compileall", "-q", str(ROOT / "backend")], capture_output=True, text=True)
check("python-compile", r.returncode == 0, (r.stderr or "compile ok").strip())

r = subprocess.run([sys.executable, "scripts/export_openapi.py", "--check"], cwd=ROOT, capture_output=True, text=True)
check("openapi-drift", r.returncode == 0, (r.stdout + r.stderr).strip()[-1200:] or "OpenAPI check completed")

try:
    openapi = json.loads((ROOT / "spec" / "api" / "openapi.json").read_text(encoding="utf-8"))
    paths = openapi.get("paths", {})
    check("openapi:period-locks", "/api/v1/accounting/period-locks" in paths, "period-lock contract")
    check("openapi:drive-readiness", "/api/v1/integrations/google-drive/evidence-readiness" in paths, "Drive evidence-readiness contract")
except (OSError, ValueError) as exc:
    check("openapi:parse", False, str(exc))

r = subprocess.run([sys.executable, "-m", "pytest", "backend/tests", "-q"], cwd=ROOT, capture_output=True, text=True)
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
check("finance-ownership-migration", len(finance_migrations) == 1, finance_migrations[0].name if len(finance_migrations) == 1 else f"found {len(finance_migrations)}")
check("period-control-migration", len(period_migrations) == 1, period_migrations[0].name if len(period_migrations) == 1 else f"found {len(period_migrations)}")

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
