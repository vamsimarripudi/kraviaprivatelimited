#!/usr/bin/env python3
import json, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,ok,detail):checks.append({'name':name,'status':'PASS' if ok else 'FAIL','detail':detail})
required=['index.html','styles.css','data.js','engine.js','app.js','web/index.html','web/app.css','web/app.js','backend/main.py','backend/models.py','spec/api/openapi.json','spec/security/PRODUCTION_GATES.md','spec/deployment/DEPLOYMENT_PLAN.md']
for f in required:check(f'required:{f}',(ROOT/f).exists(),f)
# JS syntax
for f in ['data.js','engine.js','app.js','web/app.js']:
    r=subprocess.run(['node','--check',str(ROOT/f)],capture_output=True,text=True)
    check(f'js-syntax:{f}',r.returncode==0,(r.stderr or 'syntax ok').strip())
# Python compile
r=subprocess.run([sys.executable,'-m','compileall','-q',str(ROOT/'backend')],capture_output=True,text=True)
check('python-compile',r.returncode==0,(r.stderr or 'compile ok').strip())
# Unit API test
r=subprocess.run([sys.executable,'-m','pytest','backend/tests','-q'],cwd=ROOT,capture_output=True,text=True)
check('api-smoke-test',r.returncode==0,(r.stdout+r.stderr).strip()[-1000:])
# Explicit no-fake-data policy
kos=(ROOT/'README.md').read_text(errors='ignore')+(ROOT/'SOURCE_EVIDENCE.md').read_text(errors='ignore')
check('no-fake-data-policy','fake' in kos.lower() or 'fabricat' in kos.lower(),'policy found in docs')
# Production blockers declared
status=(ROOT/'IMPLEMENTATION_STATUS.md').read_text(errors='ignore')
check('production-blocker-disclosure',('production-ready' in status.lower() or 'production activation' in status.lower() or 'external production gates' in status.lower()) and ('do not' in status.lower() or 'not describe' in status.lower()),'release rule present')

# v2 enterprise-control presence
main=(ROOT/'backend'/'main.py').read_text(errors='ignore')
models=(ROOT/'backend'/'models.py').read_text(errors='ignore')
for token in ['credit-notes','refunds','commercial/plans','banking/transactions','approvals','notices','inspections','integrations','command-center']:
    check(f'v2-api:{token}',token in main,token)
for token in ['CreditNote','Refund','CommercialPlan','Subscription','BankTransaction','ApprovalRequest','NoticeCase','InspectionCase']:
    check(f'v2-model:{token}',f'class {token}' in models,token)
summary={'generated_at':datetime.now(timezone.utc).isoformat(),'result':'PASS' if all(c['status']=='PASS' for c in checks) else 'FAIL','checks':checks}
path=ROOT/'generated'/'QUALITY_GATE_REPORT.json';path.parent.mkdir(exist_ok=True);path.write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
sys.exit(0 if summary['result']=='PASS' else 1)
