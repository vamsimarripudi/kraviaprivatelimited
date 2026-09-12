import os,tempfile
fd,path=tempfile.mkstemp(suffix='.db');os.close(fd);os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}'
os.environ['APP_ENV']='development'
from fastapi.testclient import TestClient
from backend.main import app
H={'X-Office-Actor':'Document Test','X-Office-Role':'FINANCE'}

def test_invoice_and_receipt_pdf_render():
    with TestClient(app) as c:
        prod=next(x for x in c.get('/api/v1/products',headers=H).json() if x['code']=='VF')
        cust=c.post('/api/v1/customers',headers=H|{'Idempotency-Key':'doc-cust'},json={'legal_name':'PDF Customer','state':'Andhra Pradesh','state_code':'37'}).json()
        inv=c.post('/api/v1/invoices',headers=H|{'Idempotency-Key':'doc-inv'},json={'customer_id':cust['id'],'product_id':prod['id'],'description':'VFormix subscription','sac':'9983','taxable_value':'1000','gst_rate':'18'}).json()
        pdf=c.get(f"/api/v1/invoices/{inv['id']}/pdf",headers=H)
        assert pdf.status_code==200 and pdf.headers['content-type'].startswith('application/pdf') and pdf.content[:4]==b'%PDF'
        pay=c.post(f"/api/v1/invoices/{inv['id']}/payments",headers=H|{'Idempotency-Key':'doc-pay'},json={'amount':'1180','method':'Bank Transfer','external_reference':'PDF-UTR','received_date':'2026-09-12'}).json()
        rpdf=c.get(f"/api/v1/receipts/{pay['receipt']['id']}/pdf",headers=H)
        assert rpdf.status_code==200 and rpdf.content[:4]==b'%PDF'
