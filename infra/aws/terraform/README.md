# KRAVIA AWS migration infrastructure

This is reviewable Terraform for the first EC2 backend migration in **AWS Hyderabad (`ap-south-2`)**. It is intentionally fail-closed: the provider rejects another region, a new KMS key is created by default unless a reviewed regional key is supplied, the GitHub OIDC provider requires either an existing ARN or an explicitly reviewed thumbprint, an issued ACM certificate must be supplied for the HTTPS listener, and the operator must explicitly choose whether to reuse an EC2 instance or create a new pinned-AMI instance.

## Safety boundary

This directory does not contain credentials or production values. A plan/apply must be run by an authenticated non-root AWS operator after reviewing the plan. It does not change Vercel, Railway, Supabase/Neon, DNS, or application database data. DNS validation for a newly requested ACM certificate and the final listener attachment are separate gates.

The production topology is an ALB terminating TLS and forwarding only to port 8000 on the private EC2 security group. There is no SSH ingress. SSM is the operator access path. Private-subnet egress uses one NAT gateway by default and therefore incurs AWS cost. Reusing an existing instance does not mutate its profile or security groups unless `manage_existing_instance=true` is explicitly approved.

The AWS provider has no supported Terraform resource for attaching an instance profile to an already-running instance. For an existing instance, Terraform creates the reviewed profile and security group, but the operator must perform the final profile association as a separately approved EC2/SSM maintenance step; new instances receive the profile at launch.

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

The new KMS key policy grants standard account administration plus scoped EC2/importer use; a supplied existing key is never replaced and must be reviewed by an account administrator. Existing EC2 instances cannot be made private/encrypted by this code without an explicit maintenance operation. DNS/ACM certificate validation, GitHub environment reviewers, Railway authentication, database backup/restore, staging smoke tests, and traffic cutover remain separate approvals.
