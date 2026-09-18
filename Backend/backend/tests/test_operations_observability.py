import os, tempfile

fd, path = tempfile.mkstemp(suffix=".db")
os.close(fd)
os.unlink(path)
os.environ["DATABASE_URL"] = f"sqlite:///{path}"
os.environ["APP_ENV"] = "development"
os.environ["AUTH_MODE"] = "bootstrap"
os.environ["KRAVIA_OUTBOX_ALERT_THRESHOLD"] = "25"
os.environ["KRAVIA_WORKFLOW_FAILURE_ALERT_THRESHOLD"] = "1"
os.environ.pop("KRAVIA_SLO_TELEMETRY_SOURCE", None)

from fastapi.testclient import TestClient
from backend.main import app

OWNER = {"X-Office-Actor": "Operations Owner", "X-Office-Role": "OWNER"}
AUDITOR = {"X-Office-Actor": "Operations Auditor", "X-Office-Role": "AUDITOR"}


def test_operations_summary_never_fabricates_slo_measurements():
    with TestClient(app) as client:
        response = client.get("/api/v1/operations/summary", headers=OWNER)
        assert response.status_code == 200
        body = response.json()
        assert body["slo"]["measurement_status"] == "NOT_CONNECTED"
        assert body["slo"]["measured_availability_percent"] is None
        assert body["slo"]["measured_latency_p95_ms"] is None
        assert "no fabricated uptime" in body["source"].lower()


def test_operations_evaluation_opens_backend_owned_integration_alert():
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/integrations",
            headers=OWNER,
            json={
                "provider": "Observability Test Provider",
                "integration_type": "MONITORING",
                "environment": "production",
                "status": "NOT_CONNECTED",
                "owner": "Operations",
                "config": {},
            },
        )
        assert created.status_code == 201

        evaluated = client.post("/api/v1/operations/evaluate", headers=OWNER)
        assert evaluated.status_code == 200
        changes = evaluated.json()["changes"]
        assert any(
            item["alert_key"] == "runtime:integration-readiness" and item["action"] in {"OPENED", "REOPENED"}
            for item in changes
        )

        alerts = client.get("/api/v1/operations/alerts", headers=OWNER)
        assert alerts.status_code == 200
        row = next(item for item in alerts.json() if item["alert_key"] == "runtime:integration-readiness")
        assert row["status"] == "OPEN"
        assert row["entity_type"] == "integration_registry"


def test_operations_read_is_auditor_visible_but_evaluation_is_not():
    with TestClient(app) as client:
        assert client.get("/api/v1/operations/summary", headers=AUDITOR).status_code == 200
        assert client.get("/api/v1/operations/alerts", headers=AUDITOR).status_code == 200
        assert client.post("/api/v1/operations/evaluate", headers=AUDITOR).status_code == 403
