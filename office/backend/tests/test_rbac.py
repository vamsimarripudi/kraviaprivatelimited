import os,tempfile
fd,path=tempfile.mkstemp(suffix='.db');os.close(fd);os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}';os.environ['APP_ENV']='development';os.environ['AUTH_MODE']='bootstrap'
from fastapi.testclient import TestClient
from backend.main import app

def h(role): return {'X-Office-Actor':f'{role} Test','X-Office-Role':role}

def test_server_side_role_guards():
    with TestClient(app) as c:
        # Auditor can read but cannot create customer or governance action.
        assert c.get('/api/v1/products',headers=h('AUDITOR')).status_code==200
        assert c.post('/api/v1/customers',headers=h('AUDITOR'),json={'legal_name':'Blocked','state':'AP','state_code':'37'}).status_code==403
        assert c.post('/api/v1/governance/meetings',headers=h('FINANCE'),json={'meeting_no':'BM-RBAC','meeting_date':'2026-09-12','title':'Should Block'}).status_code==403
        # Finance can create customer.
        assert c.post('/api/v1/customers',headers=h('FINANCE'),json={'legal_name':'Allowed','state':'AP','state_code':'37'}).status_code==201
        # CS can create board meeting.
        assert c.post('/api/v1/governance/meetings',headers=h('CS'),json={'meeting_no':'BM-RBAC-OK','meeting_date':'2026-09-12','title':'Allowed Governance'}).status_code==201
