import os,tempfile
fd,path=tempfile.mkstemp(suffix='.db');os.close(fd);os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}';os.environ['APP_ENV']='development';os.environ['DOCUMENT_STORAGE_DIR']=tempfile.mkdtemp(prefix='kravia-vault-')
from fastapi.testclient import TestClient
from backend.main import app
H={'X-Office-Actor':'Office Test','X-Office-Role':'OWNER'}

def test_vendor_contract_people_asset_document_vault():
    with TestClient(app) as c:
        ven=c.post('/api/v1/vendors',headers=H,json={'legal_name':'Enterprise Vendor','category':'Cloud','risk':'HIGH','product_codes':['VL','VM']})
        assert ven.status_code==201
        ctr=c.post('/api/v1/contracts',headers=H,json={'contract_no':'CTR-T01','contract_type':'Vendor Agreement','counterparty_name':'Enterprise Vendor','product_codes':['VL'],'effective_date':'2026-09-12','expiry_date':'2027-09-11','notice_days':30,'value':'50000','owner':'Operations'})
        assert ctr.status_code==201
        emp=c.post('/api/v1/people',headers=H,json={'employee_no':'EMP-T01','legal_name':'Test Employee','designation':'Operations Analyst','department':'Operations','work_email':'test.employee@example.invalid','joining_date':'2026-09-12'}).json()
        ast=c.post('/api/v1/assets',headers=H,json={'asset_no':'AST-T01','name':'Test Laptop','category':'Laptop','serial_no':'TEST-SERIAL-01','assigned_employee_id':emp['id'],'location':'Office','purchase_value':'50000'})
        assert ast.status_code==201
        content=b'%PDF-1.4\ncontrolled test document\n%%EOF\n'
        doc=c.post('/api/v1/documents',headers=H,data={'title':'Controlled Test PDF','document_type':'Evidence','area':'Audit','source':'AUTOMATED_TEST'},files={'file':('evidence.pdf',content,'application/pdf')}).json()
        assert len(doc['sha256'])==64
        lock=c.post(f"/api/v1/documents/{doc['id']}/lock",headers=H).json()
        assert lock['locked'] is True
        replacement=c.post(f"/api/v1/documents/{doc['id']}/versions",headers=H,files={'file':('replacement.pdf',content,'application/pdf')})
        assert replacement.status_code==409
        downloaded=c.get(f"/api/v1/documents/{doc['id']}/download",headers=H)
        assert downloaded.status_code==200 and downloaded.content==content
