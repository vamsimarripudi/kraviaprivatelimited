import os,tempfile
fd,path=tempfile.mkstemp(suffix='.db');os.close(fd);os.unlink(path)
os.environ['DATABASE_URL']=f'sqlite:///{path}';os.environ['APP_ENV']='development';os.environ['AUTH_MODE']='bootstrap'
from fastapi.testclient import TestClient
from backend.main import app

def test_office_web_shell_and_root_redirect():
    with TestClient(app) as c:
        r=c.get('/',follow_redirects=False)
        assert r.status_code in (302,307) and r.headers['location']=='/office/'
        w=c.get('/office/')
        assert w.status_code==200 and 'KRAVIA Office' in w.text and 'Company operating system' in w.text
        js=c.get('/office/app.js')
        assert js.status_code==200 and 'command-center' in js.text
