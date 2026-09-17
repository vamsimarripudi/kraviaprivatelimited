"""Canonical KRAVIA Office ASGI application.

Railway is an API-only runtime. The interactive KRAVIA Office and Finance
workspaces are served by the Next.js frontend, while this service owns protected
business APIs, identity enforcement, finance controls, evidence discovery and
safe operational status endpoints.
"""
from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse

from . import main as office_main
from .main import app, get_db, require_roles
from .document_engine import build_document_engine_router
from .finance_ownership import build_finance_ownership_router
from .drive_integration import build_google_drive_router
from .identity_auth import build_identity_router
from .period_controls import PeriodLockedError, build_period_control_router
from .public_status import register_public_status
from .security_controls import configure_security

# ADMIN and MEMBER are identity-domain roles. They do not receive business-domain
# authority unless an endpoint explicitly grants it through require_roles().
office_main.KNOWN_ROLES.update({"ADMIN", "MEMBER"})


@asynccontextmanager
async def canonical_lifespan(_app):
    """Keep hosted runtime startup independent of remote database latency.

    Railway runs Alembic plus controlled bootstrap as a pre-deploy command. Local
    development keeps the historical in-process bootstrap for developer ergonomics.
    """
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    if app_env not in {"staging", "production"}:
        office_main.initialize_database()
    yield


app.router.lifespan_context = canonical_lifespan

app.include_router(build_identity_router())
app.include_router(build_finance_ownership_router(get_db, require_roles))
app.include_router(build_google_drive_router(get_db, require_roles))
app.include_router(build_period_control_router(get_db, require_roles))
app.include_router(build_document_engine_router(require_roles))


@app.exception_handler(PeriodLockedError)
async def period_locked_handler(request: Request, exc: PeriodLockedError):
    return JSONResponse(
        status_code=409,
        content={
            "detail": "Financial period is locked",
            "lock_id": exc.lock_id,
            "domain": exc.domain,
            "entry_date": exc.entry_date,
        },
    )


def _remove_legacy_web_surface() -> None:
    """Remove UI routes inherited from the legacy monolithic backend module.

    The production trust boundary is deliberate: Railway serves APIs and coarse
    status only. Browser workspaces live on the canonical Vercel frontend.
    """
    app.router.routes[:] = [
        route
        for route in app.router.routes
        if not (
            getattr(route, "name", None) == "office-web"
            or (
                getattr(route, "path", None) == "/"
                and getattr(route, "name", None) == "office_root"
            )
        )
    ]


_remove_legacy_web_surface()
register_public_status(app)
configure_security(app)

_STATUS_CSS = Path(__file__).resolve().parent / "static" / "backend-status.css"


@app.get("/backend-status.css", include_in_schema=False)
def backend_status_styles():
    """Serve the single stylesheet used by the safe backend status page."""
    return FileResponse(
        _STATUS_CSS,
        media_type="text/css",
        headers={"Cache-Control": "public, max-age=3600"},
    )


__all__ = ["app"]
