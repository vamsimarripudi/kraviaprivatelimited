import os,tempfile
fd,path=tempfile.mkstemp(suffix='.db');os.close(fd);os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}';os.environ['APP_ENV']='development';os.environ['AUTH_MODE']='bootstrap'
from fastapi.testclient import TestClient
from backend.main import app
H={'X-Office-Actor':'Audit Owner','X-Office-Role':'OWNER'}
def test_hash_chained_audit_log_verifies():
    with TestClient(app) as c:
        c.post('/api/v1/customers',headers=H|{'Idempotency-Key':'audit-c1'},json={'legal_name':'Audit Customer','state':'AP','state_code':'37'})
        c.post('/api/v1/compliance',headers=H,json={'title':'Audit Control','authority':'Internal','status':'UNVERIFIED'})
        r=c.get('/api/v1/audit/verify-chain',headers=H)
        assert r.status_code==200
        body=r.json(); assert body['valid'] is True and body['event_count']>=2 and len(body['last_hash'])==64
