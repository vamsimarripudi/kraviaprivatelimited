"""Canonical KRAVIA Office ASGI application.

The legacy Office API remains intact. Finance & Ownership is attached as a bounded
domain and the production container serves the controlled Office web surface from
the same origin so authentication/CSP/API routing stay coherent.
"""
from pathlib import Path

from fastapi.staticfiles import StaticFiles

from .main import app, get_db, require_roles
from .finance_ownership import build_finance_ownership_router

app.include_router(build_finance_ownership_router(get_db, require_roles))

_WEB_DIR = Path(__file__).resolve().parent.parent / "web"
if _WEB_DIR.is_dir():
    # API/docs routes are registered before this catch-all mount, so they retain
    # normal FastAPI routing while the Office UI is served at the domain root.
    app.mount("/", StaticFiles(directory=str(_WEB_DIR), html=True), name="office-web")

__all__ = ["app"]
