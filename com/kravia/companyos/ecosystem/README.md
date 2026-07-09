# com.kravia.companyos.ecosystem

Phase 17 backend package boundary for the KRAVIA Ecosystem Product Registry and Multi-Product Control Plane.

Runtime implementation is wired into `server.mjs` for the current dependency-free Node application. When `KRAVIA_ECOSYSTEM_DATABASE_URL` or `DATABASE_URL` is configured and the `pg` package is installed, ecosystem products persist to PostgreSQL using `schema.sql`. Without a database URL, the local preview uses the existing centralized JSON data fallback so the private workspace remains runnable.

APIs:
- `POST /api/ecosystem/products`
- `GET /api/ecosystem/products`
- `GET /api/ecosystem/products/{id}`
- `PUT /api/ecosystem/products/{id}`
- `DELETE /api/ecosystem/products/{id}`
- `GET /api/ecosystem/summary`
