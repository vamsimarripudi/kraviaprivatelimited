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
    "spec/api/openapi.json", "spec/security/PRODUCTION_GATES.md", "spec/deployment/DEPLOYMENT_PLAN.md",
    "FINANCE_OWNERSHIP.md",
]
for f in required:
    check(f"required:{f}", (ROOT / f).exists(), f)

for f in ["data.js", "engine.js", "app.js", "web/app.js", "web/finance.js"]:
    r = subprocess.run(["node", "--check", str(ROOT / f)], capture_output=True, text=True)
    check(f"js-syntax:{f}", r.returncode == 0, (r.stderr or "syntax ok").strip())

r = subprocess.run([sys.executable, "-m", "compileall", "-q", str(ROOT / "backend")], capture_output=True, text=True)
check("python-compile", r.returncode == 0, (r.stderr or "compile ok").strip())

r = subprocess.run([sys.executable, "-m", "pytest", "backend/tests", "-q"], cwd=ROOT, capture_output=True, text=True)
check("api-tests", r.returncode == 0, (r.stdout + r.stderr).strip()[-1800:])

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
for token in ["credit-notes", "refunds", "commercial/plans", "banking/transactions", "approvals", "notices", "inspections", "integrations", "command-center"]:
    check(f"v2-api:{token}", token in main, token)
for token in ["CreditNote", "Refund", "CommercialPlan", "Subscription", "BankTransaction", "ApprovalRequest", "NoticeCase", "InspectionCase"]:
    check(f"v2-model:{token}", f"class {token}" in models, token)
for token in ["ownership/summary", "ownership/transfers", "finance/funding-policies", "finance/expenses", "finance/mandates", "finance/payment-instructions", "finance/webhooks/razorpay"]:
    check(f"finance-ownership-api:{token}", token in finance, token)
for token in ["ShareLedgerEntry", "ShareTransferRequest", "FundingPolicy", "ExpenseObligation", "PaymentMandate", "ContributionCall", "PaymentInstruction", "FinanceProviderEvent"]:
    check(f"finance-ownership-model:{token}", f"class {token}" in finance_models, token)

migration_dir = ROOT / "backend" / "migrations" / "versions"
finance_migrations = list(migration_dir.glob("*_v4_finance_ownership_treasury.py"))
check("finance-ownership-migration", len(finance_migrations) == 1, finance_migrations[0].name if len(finance_migrations) == 1 else f"found {len(finance_migrations)}")

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
