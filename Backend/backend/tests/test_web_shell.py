import os, tempfile

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
os.environ["DATABASE_URL"] = f"sqlite:///{path}"
os.environ["APP_ENV"] = "development"
os.environ["AUTH_MODE"] = "bootstrap"

from fastapi.testclient import TestClient
from backend.app import app


def test_backend_is_api_only_and_legacy_web_shell_is_gone():
    with TestClient(app) as client:
        root = client.get("/", follow_redirects=False)
        assert root.status_code == 200
        assert "KRAVIA Office Backend" in root.text
        assert root.headers.get("location") is None

        office = client.get("/office/", follow_redirects=False)
        assert office.status_code == 404

        legacy_asset = client.get("/office/app.js", follow_redirects=False)
        assert legacy_asset.status_code == 404
