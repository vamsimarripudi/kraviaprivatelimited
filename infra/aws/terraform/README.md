# KRAVIA AWS migration infrastructure

This is reviewable Terraform for the first EC2 backend migration in **AWS Hyderabad (`ap-south-2`)**. It is intentionally fail-closed: the provider rejects another region, the existing KMS key must be discoverable, the GitHub OIDC provider and ACM certificate must be supplied, and the operator must explicitly choose whether to reuse an EC2 instance or create a new pinned-AMI instance.

## Safety boundary

This directory does not contain credentials or production values. A plan/apply must be run by an authenticated AWS operator after reviewing the plan. It does not change Vercel, Railway, Supabase/Neon, DNS, or application database data. Do not apply it until the existing instance, KMS key, VPC/subnets, OIDC provider, and certificate have been discovered in `ap-south-2`.

The production topology is an ALB terminating TLS and forwarding only to port 8000 on the private EC2 security group. There is no SSH ingress. SSM is the operator access path. Private-subnet egress uses one NAT gateway by default and therefore incurs AWS cost. Reusing an existing instance does not mutate its profile or security groups unless `manage_existing_instance=true` is explicitly approved.

## Example review-only commands

```powershell
aws sts get-caller-identity --region ap-south-2
terraform init
terraform plan -var='region=ap-south-2' -var='network_mode=existing' `
  -var='existing_vpc_id=vpc-REVIEWED' `
  -var='existing_public_subnet_ids=["subnet-REVIEWED-A","subnet-REVIEWED-B"]' `
  -var='existing_private_subnet_ids=["subnet-REVIEWED-PRIVATE"]' `
  -var='existing_instance_id=i-REVIEWED' `
  -var='importer_principal_arn=arn:aws:iam::ACCOUNT:role/REVIEWED-operator' `
  -var='github_oidc_provider_arn=arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com' `
  -var='certificate_arn=arn:aws:acm:ap-south-2:ACCOUNT:certificate/REVIEWED'
```

Never put secret values in Terraform variables, state comments, shell history, or CI logs. Parameter values are imported separately by `infra/aws/ec2/railway_env_to_ssm.py`; only names and statuses may be reported.

## Known external gates

The KMS key policy is intentionally not replaced by Terraform. An AWS account administrator must confirm that the EC2, importer, and GitHub deploy roles are permitted by the existing key policy. Existing EC2 instances cannot be made private/encrypted by this code without an explicit maintenance operation. DNS/ACM certificate validation, GitHub environment reviewers, Railway authentication, database backup/restore, staging smoke tests, and traffic cutover remain separate approvals.
