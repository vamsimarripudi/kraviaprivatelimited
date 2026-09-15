# Controlled Company & Shareholding Bootstrap

KRAVIA Office keeps real company/shareholder data out of the public source repository. The application code is complete without embedding private or statutory particulars.

## Purpose

Use the controlled bootstrap once the reviewed incorporation/shareholding evidence is ready. The loader updates the Company Master, creates share classes/shareholders and posts opening allotments into the append-only share ledger. Re-running the same configuration is idempotent.

The loader refuses to replace an already configured CIN with a different CIN, rejects duplicate shareholder/class identifiers, rejects zero/negative allotments, and blocks any opening allocation that exceeds authorised shares.

## Files

- Template committed to Git: `config/company-master.example.json`
- Real local file: `config/company-master.local.json` (already git-ignored)
- Loader: `scripts/bootstrap_controlled_company.py`

Evidence references can point to reviewed Google Drive files or another approved evidence source. The loader records references only; it does not copy legal documents into Git.

## Run

```bash
cd office
cp config/company-master.example.json config/company-master.local.json
# Fill the local file from reviewed evidence.
alembic upgrade head
python scripts/bootstrap_controlled_company.py --config config/company-master.local.json --dry-run
python scripts/bootstrap_controlled_company.py --config config/company-master.local.json
```

For production, the loader is fail-closed. It additionally requires:

```bash
CONTROLLED_BOOTSTRAP_APPROVED=true
```

Set that only after the source evidence and statutory particulars have been reviewed. Production credentials, provider approvals, Drive OAuth/service authorization, bank/payment credentials, CA/CS configuration and DNS remain external activation items and are not manufactured by the codebase.
