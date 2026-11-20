# Codex handoff — finish KRAVIA four-part AWS EC2 migration

Repo: vamsimarripudi/kraviaprivatelimited. Read AGENTS.md, Backend/ARCHITECTURE.md and Backend/spec/deployment/DEPLOYMENT_PLAN.md. Work on a reviewed branch. Do not deploy to production or turn off Railway without evidence and authorization.

## 1 Setup
Implement reproducible Terraform/CDK staging and production in ap-south-1: VPC/SG, EC2 AL2023, IAM/instance profile, customer-managed KMS, Parameter Store, encrypted EBS snapshots/restore, ALB/ACM TLS, DNS cutover separate, SSM Agent, CloudWatch/CloudTrail/budgets. No SSH/22 public ingress. Expose EC2 port 8000 only through ALB SG. Choose instance capacity based on API+worker+ClamAV measurements. Verify instance bootstrap Docker/Compose >=2.30, AWS CLI v2, Git and Python.

## 2 Parameter Store
Audit all Railway API/worker and Vercel server variables by names only. Record target path, String/SecureString, consuming service, presence, validation, expiration, rollback and rotation without printing values. Build secure migration/import with dry-run, no secrets in shell arguments/CI logs, correct KMS and IAM. Preserve real auth keys and DATABASE_URL unchanged during cutover. Ensure private key PEMs, JSON credentials, large (>4 KB) or multiline values are handled by an explicitly tested adapter; do not truncate. Unit-test ssm_to_env.py with mocked paginated CLI, denial, malformed keys, duplicate paths and dollar-sign raw Compose values.

## 3 Git and EC2
Validate actual immutable/legacy OIDC subject string for this GitHub repository and protected aws-production Environment; restrict role conditions, IAM actions and source branch. Harden/verify aws-ec2-deploy.yml, deploy.sh and compose.yaml. No persistent GitHub AWS access keys; use SSM Run Command. Validate versioned/migration-safe releases and rollback. Test EC2 reboots, host permissions, confidential env files, KMS failures, network/TLS/ALB, logs and alarms, ClamAV updates and quarantine pipeline. Current general worker also performs mail dispatch; prevent duplicate dispatch before launching separate mail worker.

## 4 Completion
Implement staging CI and production smoke checks: Office login/OTP/TOTP/recovery, token refresh, HR/payroll, finance controls, GST disabled/sandbox/live boundaries, Brevo, public forms, file scan/quarantine/promotion, worker advisory lock/outbox/idempotency, webhook signatures, CloudWatch, database backup and isolated restore. Verify www.kraviaprivatelimited.com/office, /finance, /admin and OFFICE_API_ORIGIN. Complete approved AWS cutover with Railway fallback and rehearsed rollback; never undo issued finance records.

Output a truthful evidence report: commit/PR, provisioned AWS resources if any, parameter NAME count (never values), account and region, tests run, logs/metrics, backup/restore result, cutover decision, remaining AWS access blockers, and Railway status. Report 'not done' where unsupported.
