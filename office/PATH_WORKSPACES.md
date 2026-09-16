# KRAVIA internal path workspaces

## Canonical URL model

KRAVIA Private Limited uses one public company origin and separates private workspaces by path:

- `/` — public KRAVIA Private Limited website.
- `/office` — internal corporate operations for directors, CS/legal, HR, operations and product administration.
- `/office/login` — dedicated KRAVIA Office identity + mandatory TOTP MFA entry point.
- `/finance` — finance, accounting, GST/tax, banking, reconciliation and authorised ownership/funding views.
- `/finance/login` — the same dedicated Office identity tenant with Finance workspace role enforcement.
- `/admin` — public-website/content/request administration only. This retains the public-site Supabase identity boundary and is deliberately not KRAVIA Office authentication.

`office.kraviaprivatelimited.com` is no longer the canonical application URL. Do not remove its DNS until the path deployment is live and verified; after verification it may be retired or redirected to `/office`.

## Identity boundary

`/office` and `/finance` use the dedicated KRAVIA Office Supabase Auth project. The browser never receives Supabase access/refresh tokens in JavaScript responses or storage. The Next.js BFF stores them in `HttpOnly`, `SameSite=Strict` cookies and requires:

1. a cryptographically valid Supabase user session;
2. `office_access_status=ACTIVE` from the custom access-token hook;
3. an explicit `office_roles` assignment;
4. an `aal2` session produced by TOTP MFA;
5. a role allowed for the requested workspace/module.

There is no public Office self-registration route.

## Role routing

Office workspace roles: `OWNER`, `DIRECTOR`, `CS`, `LEGAL`, `HR`, `OPERATIONS`, `PRODUCT_ADMIN`.

Finance workspace roles: `OWNER`, `DIRECTOR`, `FINANCE`, `CA`, `AUDITOR`.

Individual modules can be narrower than the workspace. Examples: Office Security is `OWNER`/`DIRECTOR`; Finance Ownership & Funding is `OWNER`/`DIRECTOR`/`FINANCE`, so a CA can work with tax/accounting without automatically receiving ownership-administration access.

## FastAPI runtime gateway

The canonical business backend remains `office/backend/app.py` (`backend.app:app`). The public browser does not connect directly to that origin.

`/api/office-runtime/[...path]` is the same-origin BFF gateway. It:

- requires an active AAL2 Office session;
- forwards the verified Office JWT as `Authorization: Bearer ...`;
- allows only known Office API root families;
- explicitly blocks finance provider webhook paths;
- does not forward browser cookies, host headers or browser-supplied authorization;
- does not expose `OFFICE_API_ORIGIN` to the client;
- refuses upstream redirects;
- limits request body size;
- applies a browser same-origin mutation guard;
- disables caching for controlled responses.

FastAPI remains the downstream RBAC and business-rule authority, giving a second role/control check behind the Next.js workspace gate.

## Deployment variables

Public Next.js deployment requires server-side:

```text
OFFICE_SUPABASE_URL=https://xjtazosozxmudkbxqhjl.supabase.co
OFFICE_SUPABASE_PUBLISHABLE_KEY=<active modern publishable key>
OFFICE_API_ORIGIN=https://<canonical FastAPI runtime origin>
```

The FastAPI runtime must use its production OIDC configuration with issuer/JWKS for the same Supabase project and `OIDC_ROLE_CLAIM=office_roles`, `OIDC_REQUIRED_AAL=aal2`.

## Legacy route compatibility

Existing `/corporate/*` browser URLs are temporary compatibility routes. They redirect to the corresponding `/office`, `/finance` or `/admin` path with HTTP 308. New links and documentation must use the canonical path workspaces directly.

## Release sequence

1. Deploy the Next.js path workspace code with Office Supabase environment values.
2. Deploy the canonical FastAPI runtime and set `OFFICE_API_ORIGIN`.
3. Sign in through `/office/login`, enroll/verify TOTP, and confirm AAL2.
4. Verify `/office` and `/finance` with representative roles.
5. Verify the same-origin runtime gateway against the FastAPI backend.
6. Only then redirect/retire the historical Office subdomain.

No route or UI should claim a backend/provider/statutory state is connected when its canonical evidence or runtime is unavailable.
