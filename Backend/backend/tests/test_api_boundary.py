from fastapi.testclient import TestClient

from backend.app import app


def test_legacy_office_static_surface_is_not_registered():
    assert all(getattr(route, "name", None) != "office-web" for route in app.router.routes)
    assert all(
        not (
            getattr(route, "path", None) == "/"
            and getattr(route, "name", None) == "office_root"
        )
        for route in app.router.routes
    )


def test_backend_root_is_operational_status_not_workspace_ui():
    with TestClient(app) as client:
        response = client.get("/", follow_redirects=False)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert "KRAVIA Office Backend" in response.text
        assert response.headers.get("location") is None


def test_legacy_office_url_is_not_served_by_railway_backend():
    with TestClient(app) as client:
        response = client.get("/office/", follow_redirects=False)
        assert response.status_code == 404
        assert response.headers["content-type"].startswith("application/json")


def test_backend_status_asset_is_explicitly_bounded():
    with TestClient(app) as client:
        response = client.get("/backend-status.css")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/css")
        assert ":root" in response.text
