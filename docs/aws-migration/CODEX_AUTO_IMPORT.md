# One-prompt Railway → AWS Parameter Store automation for Codex

Do not manually paste Railway secret values into chat, a GitHub issue, or a GitHub file.

## Goal

Add KRAVIA's production API/worker variables from Railway to AWS Systems Manager Parameter Store using existing authenticated CLI sessions. No manual creation of 79 console fields. Preserve Railway production.

## Prerequisites

- Codex must have an **authorized local terminal** on the operator's computer or an appropriately isolated trusted runner. Cloud-hosted Codex cannot use an AWS Console browser login automatically.
- Verify region `ap-south-2` has been enabled (opt-in) and AWS identity `508563139312` is a dedicated non-root provisioning role/profile. Do not use root to create resources.
- Authenticate Railway CLI through `railway login` and AWS CLI through the correct SSO/profile. Verify AWS account ID; avoid permanent access keys.
- Install Railway CLI and Python `boto3`; do not print values or enable verbose/debug logging.
- The provisioning identity must only assume the dedicated `kravia-prod-ssm-importer` role for writes. The importer role is scoped to `/kravia/prod/*` and the Hyderabad KMS key; the provisioning identity itself must not receive direct SSM write or KMS encrypt/decrypt permissions. Verify `sts:AssumeRole` is limited to `arn:aws:iam::508563139312:role/kravia-prod-ssm-importer`, and the importer role has `ssm:GetParameter`, `ssm:PutParameter`, `kms:DescribeKey`, `kms:Encrypt`, `kms:Decrypt`, and `sts:GetCallerIdentity`.
- Work from the repository and link `railway link --project 8746e560-db2a-4834-80c5-54db0e6e013e --environment production` in a private working directory. `railway run --no-local` injects resolved source environment values at runtime without writing a plaintext export file.

## Exact Codex instruction

> Implement and validate KRAVIA AWS Parameter Store migration from the reviewed branch. Use `infra/aws/ec2/railway_env_to_ssm.py` with Railway CLI `railway run`. First confirm Railway project nurturing-healing/production and AWS Hyderabad account identity; do not reveal any variable values. Run a dry-run from the `kravia-office-api` service and then the `kravia-office-worker` service. Inspect which required values are missing, oversize, or mismatched, and verify a new customer-managed KMS key created and verified in Hyderabad (`ap-south-2`); set `KRAVIA_AWS_KMS_KEY_ID` in the authorized execution environment. After I confirm the AWS account and approve the resulting names-only dry-run, execute the API import, then the worker import with `--apply --expected-account <verified 12-digit ID>`. Never overwrite existing parameters or auto-enable financial, GST, identity or legacy review switches. Do not import Railway metadata/generation identifiers or AWS-specific host/volume endpoints unchanged. Do not expose secrets in logs or CI. Return only counts, names, errors and a redacted verification report; leave Railway running.

## Commands Codex should run

```bash
# In the checked-out KRAVIA repo, with authenticated Railway and AWS CLIs:
railway link --project 8746e560-db2a-4834-80c5-54db0e6e013e --environment production
python3 -m pip install boto3
aws configure list-profiles
aws sts get-caller-identity --profile kravia-provisioning
# Configure a temporary role profile that assumes the scoped importer role from the
# non-root provisioning profile; never use root or the provisioning profile itself
# for parameter writes.
aws configure set profile.kravia-ssm-importer.source_profile kravia-provisioning
aws configure set profile.kravia-ssm-importer.role_arn arn:aws:iam::508563139312:role/kravia-prod-ssm-importer
# Set AWS_PROFILE=kravia-ssm-importer and KRAVIA_AWS_KMS_KEY_ID=<new Hyderabad KMS key ARN>
# in the secure execution environment. Keep AWS_PROFILE=kravia-provisioning only for
# read-only discovery and Terraform provisioning.
# Do not assume the old Mumbai key exists in Hyderabad.

# Dry-runs (never print secret values):
railway run -p 8746e560-db2a-4834-80c5-54db0e6e013e -e production -s kravia-office-api --no-local python3 infra/aws/ec2/railway_env_to_ssm.py --service api
railway run -p 8746e560-db2a-4834-80c5-54db0e6e013e -e production -s kravia-office-worker --no-local python3 infra/aws/ec2/railway_env_to_ssm.py --service worker

# Only AFTER reviewing the dry-run and AWS account:
# Append --apply --expected-account ACCOUNT_ID to each command.
```

The script imports the 58 straightforward migration candidates split across API and worker. Shared names must match on repeat reads. Review-only variables (15) require explicit `--include-review` and business approval. AWS-specific replacement values (6) must be prepared separately, never copied directly from Railway. Railway-generated and deployment-generation names (17) are excluded. Thirty unconsumed Railway project-level shared names remain a separate review, not automatically provisioned.

No AWS resources or variables are created merely by committing this code. Production AWS changes are performed only when `--apply` is issued from an authorized CLI.
