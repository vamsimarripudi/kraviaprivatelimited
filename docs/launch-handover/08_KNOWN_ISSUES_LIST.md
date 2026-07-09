# KRAVIA Company OS Known Issues List

Date: July 9, 2026

## Critical Blockers

1. Settings module is missing from both frontend and backend.
2. Backend final compile, tests, and runtime API checks were not completed locally because the local Java version is 17 instead of required Java 21. The backend Maven Wrapper removes the need for a global Maven install.

## High-Priority Issues

- API permission tests for Founder, Director, and Viewer must be executed.
- Browser end-to-end QA has not been completed for login, protected routes, forms, uploads, downloads, search, reports, notifications, and AI history.
- Docker compose production test has not been executed locally.
- Refresh-token revocation during logout should be verified.
- Document upload and download authorization must be tested with real files.

## Medium-Priority Issues

- In-memory rate limiting is not suitable for multi-instance production.
- Health endpoints should be reviewed for internal-only exposure.
- Automated backup and restore process is documented but not proven.
- AI Assistant must remain restricted to stored permitted records and should be retested when an LLM provider is added.
- Report export buttons are placeholders where PDF/Excel generation has not been fully implemented.

## Low-Priority Issues

- Add more frontend component and form validation tests.
- Add accessibility automation and keyboard-navigation QA.
- Add visual regression coverage for mobile and tablet.
- Add dependency vulnerability scanning.
- Add observability dashboards beyond structured logs and health checks.

## Non-Issues Observed

- No app-source lorem ipsum was found.
- No fake records or dummy data were found in app source.
- No exposed production secrets were found.
- No frontend console logging was found in the static scan.
