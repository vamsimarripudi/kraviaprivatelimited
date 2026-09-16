import os,tempfile
fd,path=tempfile.mkstemp(suffix='.db');os.close(fd);os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}'
os.environ['APP_ENV']='development'
from fastapi.testclient import TestClient
from backend.main import app
H={'X-Office-Actor':'Ledger Test','X-Office-Role':'FINANCE'}

def test_double_entry_and_outbox():
    with TestClient(app) as c:
        prod=next(x for x in c.get('/api/v1/products',headers=H).json() if x['code']=='VM')
        cust=c.post('/api/v1/customers',headers=H|{'Idempotency-Key':'ledger-cust'},json={'legal_name':'Ledger Customer','state':'Telangana','state_code':'36'}).json()
        before=c.get('/api/v1/accounting/trial-balance',headers=H).json()
        inv=c.post('/api/v1/invoices',headers=H|{'Idempotency-Key':'ledger-inv'},json={'customer_id':cust['id'],'product_id':prod['id'],'description':'Vaanmeet services','taxable_value':'1000','gst_rate':'18'}).json()
        tb=c.get('/api/v1/accounting/trial-balance',headers=H).json()
        assert tb['balanced'] is True
        assert round(float(tb['total_debit'])-float(before['total_debit']),2)==1180.00
        assert round(float(tb['total_credit'])-float(before['total_credit']),2)==1180.00
        events=c.get('/api/v1/events/outbox',headers=H).json()
        assert any(e['event_type']=='invoice.issued' for e in events)
        c.post(f"/api/v1/invoices/{inv['id']}/payments",headers=H|{'Idempotency-Key':'ledger-pay'},json={'amount':'1180','method':'Bank Transfer','external_reference':'LEDGER-UTR','received_date':'2026-09-12'})
        tb2=c.get('/api/v1/accounting/trial-balance',headers=H).json()
        assert tb2['balanced'] is True
        assert round(float(tb2['total_debit'])-float(before['total_debit']),2)==2360.00
        assert round(float(tb2['total_credit'])-float(before['total_credit']),2)==2360.00
        events2=c.get('/api/v1/events/outbox',headers=H).json()
        types=[e['event_type'] for e in events2]
        assert 'payment.succeeded' in types and 'receipt.issued' in types
