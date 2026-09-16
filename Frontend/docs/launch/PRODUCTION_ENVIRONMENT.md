# Production environment

## Current state

The repository is production-capable but this workspace has no verified deployment provider, final domain, production backup evidence, monitoring provider, or CI deployment target configured. Treat every item as **NEEDS OWNER INPUT** until evidence is recorded in Corporate Office.

## Required verification

- Confirm the production host, branch and deployment approval policy.
- Confirm production and staging are separate from local development.
- Record the production Supabase project, region, migration head, Storage buckets, Auth URLs and backup plan without storing secrets here.
- Record monitoring, analytics, email and DNS providers by reference only.
- Apply reviewed migrations to staging before production; never run a production migration without a recovery path.