import os,tempfile
fd,path=tempfile.mkstemp(suffix='.db');os.close(fd);os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}';os.environ['APP_ENV']='development'
from fastapi.testclient import TestClient
from backend.main import app
H={'X-Office-Actor':'Governance Test','X-Office-Role':'DIRECTOR'}

def test_meeting_resolution_ctc_authority_chain():
    with TestClient(app) as c:
        bm=c.post('/api/v1/governance/meetings',headers=H,json={'meeting_no':'BM-T01','meeting_date':'2026-09-12','title':'Governance Test Meeting'}).json()
        text='RESOLVED THAT KRAVIA PRIVATE LIMITED approve the controlled test provider onboarding for governance validation.'
        scope='Represent KRAVIA PRIVATE LIMITED solely for the controlled test provider onboarding approved by this resolution.'
        br=c.post(f"/api/v1/governance/meetings/{bm['id']}/resolutions",headers=H,json={'resolution_no':'BR-T01','agenda_item':'3','title':'Controlled Provider Onboarding','resolution_text':text,'authority_scope':scope,'approved_date':'2026-09-12'}).json()
        assert len(br['content_hash'])==64
        pdf=c.get(f"/api/v1/governance/resolutions/{br['id']}/ctc.pdf",headers=H)
        assert pdf.status_code==200 and pdf.content[:4]==b'%PDF'
        auth=c.post(f"/api/v1/governance/resolutions/{br['id']}/authorities",headers=H,json={'authority_no':'AUTH-T01','grantee':'Test Director','purpose':'Controlled provider onboarding','effective_date':'2026-09-12'}).json()
        assert auth['scope_text']==scope
        events=c.get('/api/v1/events/outbox',headers=H).json()
        types=[e['event_type'] for e in events]
        assert 'board.resolution.approved' in types and 'authority.granted' in types
