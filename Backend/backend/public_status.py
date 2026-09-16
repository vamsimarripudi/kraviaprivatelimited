"""Safe public status surface for the KRAVIA Office backend.

This module intentionally exposes only high-level operational metadata. It does
not publish endpoint inventories, credentials, internal hostnames, database
connection details, user data, provider keys, or exception traces.
"""
from __future__ import annotations

import html
import os
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import text

from .database import engine

SERVICE_NAME = "KRAVIA Office Backend"
SERVICE_SLUG = "kravia-office-backend"
SERVICE_VERSION = "2.0.0"


def _database_status() -> str:
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1")).scalar_one()
        return "healthy"
    except Exception:
        return "unavailable"


def _identity_status() -> str:
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    auth_mode = os.getenv("AUTH_MODE", "bootstrap" if app_env != "production" else "oidc").strip().lower()
    if auth_mode != "oidc":
        return "development" if app_env != "production" else "misconfigured"

    required = (
        os.getenv("OIDC_ISSUER", "").strip(),
        os.getenv("OIDC_AUDIENCE", "").strip(),
        os.getenv("OIDC_JWKS_URL", "").strip(),
    )
    return "ready" if all(required) else "misconfigured"


def _health_snapshot() -> dict[str, object]:
    database = _database_status()
    identity = _identity_status()
    healthy_identity_states = {"ready", "development"}
    overall = "healthy" if database == "healthy" and identity in healthy_identity_states else "degraded"
    return {
        "status": overall,
        "service": SERVICE_SLUG,
        "version": SERVICE_VERSION,
        "environment": os.getenv("APP_ENV", "development").strip().lower(),
        "checks": {
            "database": database,
            "identity": identity,
        },
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def _data_provider_label() -> str:
    try:
        backend = engine.url.get_backend_name().lower()
    except Exception:
        backend = ""
    return "Supabase PostgreSQL" if backend.startswith("postgres") else "Local development database"


def _landing_html(snapshot: dict[str, object]) -> str:
    status = str(snapshot["status"])
    environment = html.escape(str(snapshot["environment"]).upper())
    version = html.escape(str(snapshot["version"]))
    checks = snapshot["checks"] if isinstance(snapshot.get("checks"), dict) else {}
    database = html.escape(str(checks.get("database", "unknown")))
    identity = html.escape(str(checks.get("identity", "unknown")))
    provider = html.escape(_data_provider_label())
    badge_class = "status-badge status-healthy" if status == "healthy" else "status-badge status-degraded"

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>KRAVIA Office Backend</title>
  <link rel="stylesheet" href="/backend-status.css">
</head>
<body>
  <main class="page-shell">
    <section class="hero" aria-labelledby="backend-title">
      <div class="eyebrow">KRAVIA PRIVATE LIMITED · INTERNAL PLATFORM</div>
      <div class="hero-grid">
        <div>
          <h1 id="backend-title">KRAVIA Office Backend</h1>
          <p class="hero-copy">The controlled application backend for KRAVIA Office and Finance workspaces. It coordinates company operations, governance, finance controls, workforce workflows, evidence, and audit boundaries without exposing the private API surface.</p>
        </div>
        <div class="health-card">
          <span class="{badge_class}"><span class="status-dot" aria-hidden="true"></span>{html.escape(status.title())}</span>
          <div class="health-meta"><span>Environment</span><strong>{environment}</strong></div>
          <div class="health-meta"><span>Release</span><strong>{version}</strong></div>
          <a class="health-link" href="/health">Machine health</a>
        </div>
      </div>
    </section>

    <section class="metric-grid" aria-label="Runtime status">
      <article class="metric-card"><span class="metric-label">API runtime</span><strong>FastAPI · Python 3.13</strong><p>Containerized ASGI runtime on Railway with controlled startup and deploy-time health checks.</p></article>
      <article class="metric-card"><span class="metric-label">Data plane</span><strong>{provider}</strong><p>SQLAlchemy persistence with Alembic-controlled schema evolution and isolated application ownership.</p></article>
      <article class="metric-card"><span class="metric-label">Identity boundary</span><strong>Supabase Auth · OIDC</strong><p>Signed JWT verification, role claims and MFA assurance are enforced before protected business operations.</p></article>
      <article class="metric-card"><span class="metric-label">Operational posture</span><strong>Fail closed</strong><p>Sensitive provider execution and controlled finance actions remain gated until their production prerequisites are approved.</p></article>
    </section>

    <section class="content-grid">
      <article class="panel panel-wide">
        <div class="section-kicker">Capability map</div>
        <h2>What this backend coordinates</h2>
        <div class="capability-grid">
          <div><strong>Company & governance</strong><span>Controlled company master, board decisions, authorities and compliance records.</span></div>
          <div><strong>Finance & ownership</strong><span>Billing, accounting controls, GST boundaries, funding, ownership and reconciliation workflows.</span></div>
          <div><strong>Workforce operations</strong><span>Role-scoped people, access, assets, requests, approvals and joiner/mover/leaver controls.</span></div>
          <div><strong>Commercial operations</strong><span>Products, customers, contracts, vendors, subscriptions and controlled payment records.</span></div>
          <div><strong>Evidence & documents</strong><span>Versioned records, controlled document handling and read-only evidence integrations.</span></div>
          <div><strong>Audit & close controls</strong><span>Tamper-evident activity, workflow history and accounting/tax period locks.</span></div>
        </div>
      </article>

      <article class="panel">
        <div class="section-kicker">Live checks</div>
        <h2>Service health</h2>
        <div class="check-row"><span>Database connectivity</span><strong class="check-value">{database}</strong></div>
        <div class="check-row"><span>Identity configuration</span><strong class="check-value">{identity}</strong></div>
        <div class="check-row"><span>Transport</span><strong class="check-value">HTTPS</strong></div>
        <p class="muted">Only coarse health signals are public. Internal dependency addresses and exception details are intentionally suppressed.</p>
      </article>

      <article class="panel">
        <div class="section-kicker">Security boundary</div>
        <h2>Designed for restricted access</h2>
        <ul class="security-list">
          <li>OIDC/JWKS token verification</li>
          <li>MFA AAL2 enforcement for protected sessions</li>
          <li>Role and permission checks at execution time</li>
          <li>Host and browser-origin allowlists</li>
          <li>Mutation rate limiting and security headers</li>
          <li>Immutable audit and controlled workflow history</li>
        </ul>
      </article>
    </section>

    <section class="disclosure-panel">
      <div>
        <div class="section-kicker">Deliberate disclosure boundary</div>
        <h2>Private interfaces stay private.</h2>
      </div>
      <p>This surface is intentionally an architectural overview, not API documentation. Route inventories, credentials, internal hostnames, database connection details, provider keys, company-private records and stack traces are not published here.</p>
    </section>

    <footer>
      <span>KRAVIA Office Backend</span>
      <span>Controlled internal infrastructure</span>
    </footer>
  </main>
</body>
</html>"""


def register_public_status(app: FastAPI) -> None:
    """Replace the legacy health route and register safe public status surfaces."""
    app.router.routes[:] = [route for route in app.router.routes if getattr(route, "path", None) != "/health"]

    @app.get("/health")
    def health():
        snapshot = _health_snapshot()
        status_code = 200 if snapshot["status"] == "healthy" else 503
        return JSONResponse(
            snapshot,
            status_code=status_code,
            headers={"Cache-Control": "no-store, max-age=0"},
        )

    @app.get("/health/live", include_in_schema=False)
    def liveness():
        return JSONResponse(
            {"status": "ok", "service": SERVICE_SLUG},
            status_code=200,
            headers={"Cache-Control": "no-store, max-age=0"},
        )

    @app.get("/", include_in_schema=False, response_class=HTMLResponse)
    def backend_home():
        snapshot = _health_snapshot()
        return HTMLResponse(
            _landing_html(snapshot),
            status_code=200,
            headers={
                "Cache-Control": "no-store, max-age=0",
                "X-Robots-Tag": "noindex, nofollow, noarchive",
            },
        )
