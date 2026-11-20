# KRAVIA — AWS EC2 migration: four parts

**Decision: Hyderabad (`ap-south-2`), AWS account `508563139312` — replaces Mumbai, subject to opt-in Region enablement. Create new KMS key in Hyderabad; earlier Mumbai KMS ID is NOT available in Hyderabad. IAM account-wide, KMS/SSM/EC2/ACM regional. AWS root authentication is read-only discovery only, NOT authorized to provision.**

**State: scaffold only. AWS resources, secret migration, EC2 runtime and production cutover are NOT complete.**
Source: vamsimarripudi/kraviaprivatelimited. Keep Next.js frontend on Vercel, databases on current provider and Railway as fallback until the first AWS backend cutover passes.

## 1. Setup
- Prepare AWS ap-south-2 account with MFA, CloudTrail, AWS Budgets, CloudWatch, encrypted EBS/backup, a staging environment and controlled IAM roles.
- Create VPC/SG, EC2 Amazon Linux 2023, ALB TLS/ACM for api.kraviaprivatelimited.com. EC2 port 8000 accepts connections ONLY from ALB SG; disable public port 22. Manage EC2 with Systems Manager.
- Install AWS CLI v2, SSM Agent, Docker Engine, Docker Compose >=2.30, Git and Python 3. Verify account, region, permissions and CloudWatch log destinations before deploying.
- On EC2, clone repo to /opt/kravia/repo, install infra/aws/ec2/deploy.sh as root-owned /opt/kravia/deploy.sh (0700), make /etc/kravia (0700) and /var/lib/kravia/private-vault owned by uid/gid 10001 on encrypted EBS.

## 2. Variables in Parameter Store
- Names: /kravia/prod/shared/VARIABLE, /kravia/prod/api/VARIABLE, /kravia/prod/worker/VARIABLE. Separate /kravia/staging roots.
- SecureString under customer-managed KMS key for auth, database, Brevo, tax, bank and storage credentials; String for non-secret flags/URLs; narrowly grant SSM and KMS access to EC2 role.
- Inventory actual Railway API (85 names including auto-injected Railway variables), worker (43 names including injected values) and Vercel BFF server-only values. Do not transfer RAILWAY_* or obsolete values.
- Transfer values from authorized providers WITHOUT printing or committing them. Railway OAuth connector currently lists names but redacts values. Never fabricate secrets.
- Standard SSM parameters max 4 KB. Use a vetted adapter for oversized/multiline values. ssm_to_env.py generates root-only raw env files; require Compose >=2.30 and an encrypted EC2 volume.
- Keep Vercel's necessary server-side variables in place; do not rotate OFFICE_AUTH_BOOTSTRAP_SECRET or OFFICE_AUTH_SIGNING_SECRET blindly.

## 3. Git + EC2
- Protect main and the aws-production GitHub Environment with required human approvals, restrict its OIDC trust to the actual GitHub subject format, and scope the deploy IAM role to approved instance + AWS-RunShellScript.
- GitHub environment vars: KRAVIA_AWS_DEPLOY_ROLE_ARN and KRAVIA_AWS_EC2_INSTANCE_ID (identifiers only). No long-lived AWS keys.
- Run infra/aws/ec2/compose.yaml on EC2: FastAPI API, general worker, ClamAV. Verify the current worker already calls mail dispatchers; do NOT start a duplicate mail worker until dispatch ownership is proven.
- Before manual deploy: verify staging, backup/restore, migrations, secrets present, ALB and ClamAV readiness. Deploy reviewed main SHA via SSM, run health checks, then separately update OFFICE_API_ORIGIN on Vercel after acceptance.

## 4. Codex completion
- Follow docs/aws-migration/CODEX_HANDOFF.md to finish IaC, IAM, host bootstrap, secure import and tests, monitoring, cutover and rollback with evidence.
- Preserve existing production Railway until AWS is verified. No database or frontend provider migration during this EC2-first step.
