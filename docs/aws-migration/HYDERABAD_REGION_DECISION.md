# KRAVIA AWS Region Decision — Hyderabad

**Approved deployment region:** Asia Pacific (Hyderabad) `ap-south-2`.

**AWS account observed by Codex:** `508563139312`.

**Critical evidence provided:** Codex reported root credentials (`arn:aws:iam::508563139312:root`) and, from read-only discovery in Hyderabad, no existing KRAVIA EC2, customer-managed KMS key, SSM managed node, regional ACM certificate or GitHub OIDC provider.

## Mandatory execution rules

1. Hyderabad is an AWS opt-in region. Verify it is enabled for the account. Do not use Mumbai (`ap-south-1`) in newly provisioned resources.
2. Never provision or migrate secrets using the root identity. Use an authorized named IAM role/Identity Center profile with MFA and time-limited credentials. Confirm `aws sts get-caller-identity` returns a non-root ARN in the intended account.
3. Re-run the read-only Hyderabad discovery through that dedicated profile. If the resources are still absent, create NEW EC2, KMS, ACM and other regional infrastructure using reviewed IaC in Hyderabad. Do not create duplicate resources and do not delete Mumbai resources.
4. **Do not reuse the earlier KMS Key ID `0d7820e2-bd32-48e4-8246-f0082aeebc04`.** It was not found in Hyderabad. Create a Hyderabad customer-managed symmetric key with a suitable alias (e.g. `alias/kravia-prod-ssm`) and a reviewed key policy. Set `KRAVIA_AWS_KMS_KEY_ID` to the actual new key ARN/ID when running the importer.
5. Use `ap-south-2` in IAM Parameter Store resource ARNs and the KMS ViaService condition `ssm.ap-south-2.amazonaws.com`. Treat IAM GitHub OIDC as account-level, not regional; verify before creation.
6. Keep the public API hostname `api.kraviaprivatelimited.com` unchanged. Issue an ACM certificate in Hyderabad for the Hyderabad ALB and switch DNS/Vercel `OFFICE_API_ORIGIN` only after passing health, auth/MFA and rollback acceptance.
7. Parameter Store paths remain `/kravia/prod/shared/`, `/kravia/prod/api/` and `/kravia/prod/worker/` **inside the Hyderabad region**. SSM paths don't contain region codes; the AWS client and IAM ARNs do.
8. Retain Railway production and the existing Vercel frontend and external DB/storage integrations during the initial EC2 cutover. Avoid duplicate worker execution.

**Status:** Repository region/configuration amendment only. No Hyderabad AWS resources or parameter values were created by this commit. Verification and provisioning must be executed in Codex's authorized, non-root AWS environment.
