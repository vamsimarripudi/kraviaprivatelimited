import os,tempfile
fd,path=tempfile.mkstemp(suffix='.db');os.close(fd);os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}';os.environ['APP_ENV']='development';os.environ['AUTH_MODE']='bootstrap';os.environ['DOCUMENT_STORAGE_DIR']=tempfile.mkdtemp(prefix='kravia-v2-vault-')
from fastapi.testclient import TestClient
from backend.main import app

def h(role,actor): return {'X-Office-Actor':actor,'X-Office-Role':role}

def test_maker_checker_notice_inspection_integration_secret_rejection():
    with TestClient(app) as c:
        req=c.post('/api/v1/approvals',headers=h('FINANCE','Maker'),json={'action_type':'MANUAL_JOURNAL','entity_type':'journal','entity_id':'JE-X','required_role':'DIRECTOR','reason':'Test maker checker'}).json()
        own=c.post(f"/api/v1/approvals/{req['id']}/approve",headers=h('DIRECTOR','Maker'),json={'reason':'self approve'})
        assert own.status_code==409
        ok=c.post(f"/api/v1/approvals/{req['id']}/approve",headers=h('DIRECTOR','Checker'),json={'reason':'Reviewed'})
        assert ok.status_code==200 and ok.json()['status']=='APPROVED'
        content=b'%PDF-1.4\nnotice\n%%EOF\n'
        doc=c.post('/api/v1/documents',headers=h('LEGAL','Legal'),data={'title':'GST Notice','document_type':'Notice','area':'Tax','source':'TEST'},files={'file':('notice.pdf',content,'application/pdf')}).json()
        c.post(f"/api/v1/documents/{doc['id']}/lock",headers=h('LEGAL','Legal'))
        notice=c.post('/api/v1/notices',headers=h('LEGAL','Legal'),json={'authority':'GST','reference_no':'GST-N-001','title':'GST Verification Notice','received_date':'2026-09-12','response_due_date':'2026-09-20','risk':'HIGH','owner':'CA','source_document_id':doc['id']})
        assert notice.status_code==201
        insp=c.post('/api/v1/inspections',headers=h('DIRECTOR','Director'),json={'authority':'GST','reference_no':'INSP-001','scope_text':'GST records for September 2026','period_start':'2026-09-01','period_end':'2026-09-30','owner':'Finance'}).json()
        manifest=c.post(f"/api/v1/inspections/{insp['id']}/build-manifest",headers=h('DIRECTOR','Director'),json=[doc['id']]).json()
        assert manifest['readiness']=='READY' and manifest['documents'][0]['sha256']==doc['sha256']
        bad=c.post('/api/v1/integrations',headers=h('OWNER','Owner'),json={'provider':'Razorpay','integration_type':'PAYMENTS','config':{'api_key':'should-not-be-stored'}})
        assert bad.status_code==422
        good=c.post('/api/v1/integrations',headers=h('OWNER','Owner'),json={'provider':'Razorpay','integration_type':'PAYMENTS','status':'NOT_CONNECTED','config':{'secret_reference':'ssm:/kravia/razorpay'}})
        assert good.status_code==201
