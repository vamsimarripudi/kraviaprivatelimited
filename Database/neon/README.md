# Website privacy database

This directory contains migrations for the isolated Neon Postgres project used
only by the public website's pseudonymous privacy-preference record. It is not
the KRAVIA Office control-plane database and must not receive Office tables,
identity data, public enquiry records, or provider credentials.

Apply migrations in filename order with Neon's **direct, non-pooled** URL from
a controlled operator session. The Next.js application uses only the separate
pooled `KRAVIA_WEBSITE_CONSENT_DATABASE_URL` server variable. Do not commit
either URL, a `.neon` context file, or migration output containing credentials.

The route is fail-closed: if the database variable or schema is unavailable,
the website leaves optional technologies disabled and returns a temporary
unavailable response rather than saving a browser-only preference.
