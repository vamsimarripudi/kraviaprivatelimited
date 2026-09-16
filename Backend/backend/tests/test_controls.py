import os, tempfile
fd,path=tempfile.mkstemp(suffix='.db'); os.close(fd); os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}'
os.environ['APP_ENV']='development'
from fastapi.testclient import TestClient
from backend.main import app
H={'X-Office-Actor':'Control Test','X-Office-Role':'OWNER'}

def bootstrap(c,state_code='36'):
    products=c.get('/api/v1/products',headers=H).json(); vl=next(x for x in products if x['code']=='VL')
    cust=c.post('/api/v1/customers',headers=H|{'Idempotency-Key':f'cust-{state_code}'},json={'legal_name':f'Test Customer {state_code}','state':'Test State','state_code':state_code}).json()
    return vl,cust

def test_interstate_igst_and_sequence_length():
    with TestClient(app) as c:
        vl,cust=bootstrap(c,'36')
        inv=c.post('/api/v1/invoices',headers=H|{'Idempotency-Key':'inter-inv'},json={'customer_id':cust['id'],'product_id':vl['id'],'description':'Service','taxable_value':'1000','gst_rate':'18'}).json()
        assert inv['igst']=='180.00' and inv['cgst']=='0.00' and inv['sgst']=='0.00'
        assert len(inv['invoice_no'])<=16

def test_idempotent_invoice_and_payment_and_overpayment_guard():
    with TestClient(app) as c:
        vl,cust=bootstrap(c,'37')
        body={'customer_id':cust['id'],'product_id':vl['id'],'description':'Service','taxable_value':'1000','gst_rate':'18'}
        a=c.post('/api/v1/invoices',headers=H|{'Idempotency-Key':'same-inv'},json=body).json()
        b=c.post('/api/v1/invoices',headers=H|{'Idempotency-Key':'same-inv'},json=body).json()
        assert a['id']==b['id'] and a['invoice_no']==b['invoice_no']
        bad=c.post(f"/api/v1/invoices/{a['id']}/payments",headers=H,json={'amount':'1180.01','method':'Bank Transfer','external_reference':'OVER-1','received_date':'2026-09-12'})
        assert bad.status_code==422
        pay_body={'amount':'1180','method':'Bank Transfer','external_reference':'UTR-ABC','received_date':'2026-09-12'}
        p1=c.post(f"/api/v1/invoices/{a['id']}/payments",headers=H|{'Idempotency-Key':'same-pay'},json=pay_body).json()
        p2=c.post(f"/api/v1/invoices/{a['id']}/payments",headers=H|{'Idempotency-Key':'same-pay'},json=pay_body).json()
        assert p1['payment']['id']==p2['payment']['id']
        assert p1['receipt']['receipt_no'].startswith('R/') and len(p1['receipt']['receipt_no'])<=16

def test_duplicate_external_payment_reference_blocked_across_new_idempotency_key():
    with TestClient(app) as c:
        vl,cust=bootstrap(c,'37')
        inv=c.post('/api/v1/invoices',headers=H|{'Idempotency-Key':'dup-inv'},json={'customer_id':cust['id'],'product_id':vl['id'],'description':'Service','taxable_value':'2000','gst_rate':'18'}).json()
        body={'amount':'100','method':'Bank Transfer','external_reference':'UNIQUE-UTR','received_date':'2026-09-12'}
        first=c.post(f"/api/v1/invoices/{inv['id']}/payments",headers=H|{'Idempotency-Key':'dup-pay-1'},json=body)
        assert first.status_code==201
        second=c.post(f"/api/v1/invoices/{inv['id']}/payments",headers=H|{'Idempotency-Key':'dup-pay-2'},json=body)
        assert second.status_code==409

def test_public_invoice_verification_exposes_only_safe_metadata():
    with TestClient(app) as c:
        vl,cust=bootstrap(c,'37')
        inv=c.post('/api/v1/invoices',headers=H|{'Idempotency-Key':'verify-inv'},json={'customer_id':cust['id'],'product_id':vl['id'],'description':'Verification Service','taxable_value':'500','gst_rate':'18'}).json()
        r=c.get('/verify/invoice/'+inv['invoice_no'])
        assert r.status_code==200
        body=r.json()
        assert body['valid'] is True and body['document_number']==inv['invoice_no']
        assert len(body['hash'])==64
        assert 'customer_id' not in body and 'total' not in body and 'gstin' not in body
