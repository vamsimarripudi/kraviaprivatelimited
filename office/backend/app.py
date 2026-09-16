"""Canonical KRAVIA Office ASGI application.

The legacy Office API remains intact. Finance & Ownership, controlled period
close, production identity/MFA, and read-only Google Drive evidence discovery
are attached as bounded domains. The production container serves the controlled
Office web surface from the same origin so authentication/CSP/API routing stay
coherent.
"""
from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import main as office_main
from .main import app, get_db, require_roles
from .finance_ownership import build_finance_ownership_router
from .drive_integration import build_google_drive_router
from .identity_auth import build_identity_router
from .period_controls import PeriodLockedError, build_period_control_router
from .public_status import register_public_status
from .security_controls import configure_security

# ADMIN and MEMBER are identity-domain roles. They do not receive business-domain
# authority unless an endpoint explicitly grants it through require_roles().
office_main.KNOWN_ROLES.update({"ADMIN", "MEMBER"})

app.include_router(build_identity_router())
app.include_router(build_finance_ownership_router(get_db, require_roles))
app.include_router(build_google_drive_router(get_db, require_roles))
app.include_router(build_period_control_router(get_db, require_roles))


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


# Register the safe public backend overview and replace the legacy coarse health
# route before the catch-all static Office surface is mounted.
register_public_status(app)
configure_security(app)

_WEB_DIR = Path(__file__).resolve().parent.parent / "web"
if _WEB_DIR.is_dir():
    # API/docs/status routes are registered before this catch-all mount, so they
    # retain normal FastAPI routing while legacy Office assets remain available.
    app.mount("/", StaticFiles(directory=str(_WEB_DIR), html=True), name="office-web")

__all__ = ["app"]
