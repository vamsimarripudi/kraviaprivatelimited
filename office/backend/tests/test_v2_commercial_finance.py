import os,tempfile
fd,path=tempfile.mkstemp(suffix='.db');os.close(fd);os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}';os.environ['APP_ENV']='development';os.environ['AUTH_MODE']='bootstrap'
from fastapi.testclient import TestClient
from backend.main import app

def h(role='FINANCE',actor=None): return {'X-Office-Actor':actor or f'{role} Test','X-Office-Role':role}

def test_plan_subscription_credit_note_refund_banking_and_command_center():
    with TestClient(app) as c:
        prod=next(x for x in c.get('/api/v1/products',headers=h()).json() if x['code']=='VL')
        cust=c.post('/api/v1/customers',headers=h()|{'Idempotency-Key':'v2-cust'},json={'legal_name':'V2 School','state':'Andhra Pradesh','state_code':'37'}).json()
        plan=c.post('/api/v1/commercial/plans',headers=h(),json={'product_id':prod['id'],'code':'GROWTH','name':'Growth','billing_cycle':'MONTHLY','price':'6999','gst_rate':'18','sac':'9983','effective_from':'2026-09-01'}).json()
        sub=c.post('/api/v1/commercial/subscriptions',headers=h()|{'Idempotency-Key':'v2-sub'},json={'customer_id':cust['id'],'plan_id':plan['id'],'started_at':'2026-09-12','current_period_start':'2026-09-12','current_period_end':'2026-10-11'}).json()
        assert sub['status']=='ACTIVE'
        inv=c.post('/api/v1/invoices',headers=h()|{'Idempotency-Key':'v2-inv'},json={'customer_id':cust['id'],'product_id':prod['id'],'description':'Growth plan','sac':'9983','taxable_value':'1000','gst_rate':'18'}).json()
        pay=c.post(f"/api/v1/invoices/{inv['id']}/payments",headers=h()|{'Idempotency-Key':'v2-pay'},json={'amount':'1180','method':'Bank Transfer','external_reference':'V2-UTR','received_date':'2026-09-12'}).json()
        cn=c.post(f"/api/v1/invoices/{inv['id']}/credit-notes",headers=h()|{'Idempotency-Key':'v2-cn'},json={'reason':'Approved service adjustment','taxable_value':'100'}).json()
        assert cn['total']=='118.00' and len(cn['credit_note_no'])<=16
        rf=c.post(f"/api/v1/payments/{pay['payment']['id']}/refunds",headers=h()|{'Idempotency-Key':'v2-rf'},json={'amount':'118','reason':'Refund against approved credit','external_reference':'RFD-V2-01','refunded_date':'2026-09-12','credit_note_id':cn['id']})
        assert rf.status_code==201 and rf.json()['amount']=='118.00'
        bank=c.post('/api/v1/banking/accounts',headers=h('OWNER'),json={'bank_name':'HDFC Bank','account_name':'KRAVIA PRIVATE LIMITED','masked_account':'XXXXXXXX7916','ifsc':'HDFC0000001','purpose':'Current Account'}).json()
        tx=c.post('/api/v1/banking/transactions',headers=h(),json={'bank_account_id':bank['id'],'transaction_date':'2026-09-12','amount':'1180','direction':'CREDIT','reference':'V2-UTR','description':'Customer receipt'}).json()
        match=c.post(f"/api/v1/banking/transactions/{tx['id']}/auto-match",headers=h()).json()
        assert match['match_status']=='MATCHED'
        cc=c.get('/api/v1/command-center',headers=h()).json()
        assert cc['records']['subscriptions']>=1 and float(cc['financial']['collected'])>=1180.00
        tb=c.get('/api/v1/accounting/trial-balance',headers=h()).json()
        assert tb['balanced'] is True
