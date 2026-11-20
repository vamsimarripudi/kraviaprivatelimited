# One-prompt Railway → AWS Parameter Store automation for Codex

Do not manually paste Railway secret values into chat, a GitHub issue, or a GitHub file.

## Goal

Add KRAVIA's production API/worker variables from Railway to AWS Systems Manager Parameter Store using existing authenticated CLI sessions. No manual creation of 79 console fields. Preserve Railway production.

## Prerequisites

- Codex must have an **authorized local terminal** on the operator's computer or an appropriately isolated trusted runner. Cloud-hosted Codex cannot use an AWS Console browser login automatically.
- Authenticate Railway CLI through `railway login` and AWS CLI through the correct SSO/profile. Verify AWS account ID; avoid permanent access keys.
- Install Railway CLI and Python `boto3`; do not print values or enable verbose/debug logging.
- Authorized AWS operator needs `ssm:GetParameter`, `ssm:PutParameter`, `kms:DescribeKey`, `kms:Encrypt`, `kms:Decrypt`, `sts:GetCallerIdentity`; KMS key policy must permit use.
- Work from the repository and link `railway link --project 8746e560-db2a-4834-80c5-54db0e6e013e --environment production` in a private working directory. `railway run --no-local` injects resolved source environment values at runtime without writing a plaintext export file.

## Exact Codex instruction

> Implement and validate KRAVIA AWS Parameter Store migration from the reviewed branch. Use `infra/aws/ec2/railway_env_to_ssm.py` with Railway CLI `railway run`. First confirm Railway project nurturing-healing/production and AWS Mumbai account identity; do not reveal any variable values. Run a dry-run from the `kravia-office-api` service and then the `kravia-office-worker` service. Inspect which required values are missing, oversize, or mismatched, and verify KMS key `0d7820e2-bd32-48e4-8246-f0082aeebc04`. After I confirm the AWS account and approve the resulting names-only dry-run, execute the API import, then the worker import with `--apply --expected-account <verified 12-digit ID>`. Never overwrite existing parameters or auto-enable financial, GST, identity or legacy review switches. Do not import Railway metadata/generation identifiers or AWS-specific host/volume endpoints unchanged. Do not expose secrets in logs or CI. Return only counts, names, errors and a redacted verification report; leave Railway running.

## Commands Codex should run

```bash
# In the checked-out KRAVIA repo, with authenticated Railway and AWS CLIs:
railway link --project 8746e560-db2a-4834-80c5-54db0e6e013e --environment production
python3 -m pip install boto3

# Dry-runs (never print secret values):
railway run -p 8746e560-db2a-4834-80c5-54db0e6e013e -e production -s kravia-office-api --no-local python3 infra/aws/ec2/railway_env_to_ssm.py --service api
railway run -p 8746e560-db2a-4834-80c5-54db0e6e013e -e production -s kravia-office-worker --no-local python3 infra/aws/ec2/railway_env_to_ssm.py --service worker

# Only AFTER reviewing the dry-run and AWS account:
# Append --apply --expected-account ACCOUNT_ID to each command.
```

The script imports the 58 straightforward migration candidates split across API and worker. Shared names must match on repeat reads. Review-only variables (15) require explicit `--include-review` and business approval. AWS-specific replacement values (6) must be prepared separately, never copied directly from Railway. Railway-generated and deployment-generation names (17) are excluded. Thirty unconsumed Railway project-level shared names remain a separate review, not automatically provisioned.

No AWS resources or variables are created merely by committing this code. Production AWS changes are performed only when `--apply` is issued from an authorized CLI.
