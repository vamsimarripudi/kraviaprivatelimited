#!/usr/bin/env python3
"""Import Railway-injected runtime variables directly to AWS SSM without exporting .env files.

Run through 'railway run ... --no-local -- python3 infra/aws/ec2/railway_env_to_ssm.py'
with an AWS-authenticated operator environment. DRY-RUN by default.
"""
from __future__ import annotations

import argparse
import os
import re
import sys

MIGRATE = set("""APP_ENV AUTH_MODE BREVO_API_KEY BREVO_SENDER_EMAIL BREVO_SENDER_NAME
CLAMAV_PORT CLAMAV_SCAN_TIMEOUT_SECONDS DATABASE_EXECUTION_ROLE DATABASE_URL
GOOGLE_DRIVE_ROOT_FOLDER_ID GOOGLE_DRIVE_TIMEOUT_SECONDS GST_GSP_BASE_URL
GST_GSP_CLIENT_ID GST_GSP_CLIENT_SECRET GST_GSP_ENVIRONMENT GST_GSP_FILING_CONTRACT
GST_GSP_PROVIDER GST_GSP_STATE_CODE GST_GSP_TIMEOUT_SECONDS GST_GSP_USERNAME
GST_GSTR1_CURRENT_YEAR_TURNOVER GST_GSTR1_PREV_YEAR_TURNOVER KRAVIA_CIN
KRAVIA_CLAMAV_SELF_TEST_ATTEMPTS KRAVIA_CLAMAV_SELF_TEST_ON_STARTUP
KRAVIA_CLAMAV_SELF_TEST_RETRY_SECONDS KRAVIA_FILE_PIPELINE_SELF_TEST_ATTEMPTS
KRAVIA_FILE_PIPELINE_SELF_TEST_ON_STARTUP KRAVIA_FILE_PIPELINE_SELF_TEST_RETRY_SECONDS
KRAVIA_FILE_SCAN_BATCH_SIZE KRAVIA_GSTIN KRAVIA_LEGAL_NAME
KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET KRAVIA_REGISTERED_OFFICE
KRAVIA_STORAGE_BROKER_KEY_A KRAVIA_STORAGE_BROKER_KEY_B KRAVIA_STORAGE_BROKER_KEY_C
KRAVIA_STORAGE_BROKER_PRIVATE_KEY KRAVIA_STORAGE_BROKER_PRIVATE_KEY_B64
KRAVIA_STORAGE_BROKER_TIMEOUT_SECONDS KRAVIA_STORAGE_BROKER_URL
KRAVIA_STORAGE_DOWNLOAD_TIMEOUT_SECONDS KRAVIA_WORKER_BATCH_SIZE
KRAVIA_WORKER_INTERVAL_SECONDS MAX_UPLOAD_BYTES OFFICE_AUTH_BOOTSTRAP_SECRET
OFFICE_AUTH_BREAK_GLASS_SECRET OFFICE_AUTH_EMAIL_DOMAIN OFFICE_AUTH_SIGNING_SECRET
OFFICE_FILE_SCAN_MAX_BYTES OFFICE_FILE_SCAN_TIMEOUT_SECONDS
OFFICE_MUTATION_RATE_LIMIT OFFICE_RATE_LIMIT_WINDOW_SECONDS OFFICE_REQUIRED_AAL
SUPABASE_POOLER_HOST SUPABASE_POOLER_PORT SUPABASE_POOLER_USER
SUPABASE_PUBLISHABLE_KEY""".split())

REVIEW = set("""FINANCE_EXECUTION_MODE GST_EINVOICE_ENABLED KRAVIA_DB_BACKUP_KEY
KRAVIA_PLAY_REVIEWER_EMAIL KRAVIA_PLAY_REVIEWER_EXPIRES_AT KRAVIA_PLAY_REVIEWER_OTP
KRAVIA_PLAY_REVIEWER_PASSWORD OIDC_ACTOR_CLAIM OIDC_AUDIENCE OIDC_ISSUER
OIDC_JWKS_URL OIDC_REQUIRED_AAL OIDC_ROLE_CLAIM SUPABASE_AUTH_URL
TAX_CONFIG_APPROVED""".split())

# Never copy these directly: values depend on AWS routing, encryption, volume layout or approved egress.
RECONFIGURE = set("""CLAMAV_HOST DOCUMENT_STORAGE_DIR GST_GSP_IP_USR
OFFICE_ALLOWED_HOSTS OFFICE_ALLOWED_ORIGINS PUBLIC_BASE_URL""".split())

SHARED = set("""APP_ENV CLAMAV_HOST CLAMAV_PORT CLAMAV_SCAN_TIMEOUT_SECONDS
DATABASE_EXECUTION_ROLE DATABASE_URL FINANCE_EXECUTION_MODE KRAVIA_FILE_SCAN_BATCH_SIZE
KRAVIA_STORAGE_BROKER_KEY_A KRAVIA_STORAGE_BROKER_KEY_B KRAVIA_STORAGE_BROKER_KEY_C
KRAVIA_STORAGE_BROKER_PRIVATE_KEY KRAVIA_STORAGE_BROKER_PRIVATE_KEY_B64
KRAVIA_STORAGE_BROKER_TIMEOUT_SECONDS KRAVIA_STORAGE_BROKER_URL
KRAVIA_STORAGE_DOWNLOAD_TIMEOUT_SECONDS SUPABASE_AUTH_URL SUPABASE_POOLER_HOST
SUPABASE_POOLER_PORT SUPABASE_POOLER_USER SUPABASE_PUBLISHABLE_KEY
TAX_CONFIG_APPROVED""".split())

API_ONLY = set("""AUTH_MODE BREVO_API_KEY BREVO_SENDER_EMAIL BREVO_SENDER_NAME
DOCUMENT_STORAGE_DIR GOOGLE_DRIVE_ROOT_FOLDER_ID GOOGLE_DRIVE_TIMEOUT_SECONDS
GST_EINVOICE_ENABLED GST_GSP_BASE_URL GST_GSP_CLIENT_ID GST_GSP_CLIENT_SECRET
GST_GSP_ENVIRONMENT GST_GSP_FILING_CONTRACT GST_GSP_IP_USR GST_GSP_PROVIDER
GST_GSP_STATE_CODE GST_GSP_TIMEOUT_SECONDS GST_GSP_USERNAME
GST_GSTR1_CURRENT_YEAR_TURNOVER GST_GSTR1_PREV_YEAR_TURNOVER KRAVIA_CIN
KRAVIA_DB_BACKUP_KEY KRAVIA_GSTIN KRAVIA_LEGAL_NAME KRAVIA_PLAY_REVIEWER_EMAIL
KRAVIA_PLAY_REVIEWER_EXPIRES_AT KRAVIA_PLAY_REVIEWER_OTP
KRAVIA_PLAY_REVIEWER_PASSWORD KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET
KRAVIA_REGISTERED_OFFICE MAX_UPLOAD_BYTES OFFICE_ALLOWED_HOSTS OFFICE_ALLOWED_ORIGINS
OFFICE_AUTH_BOOTSTRAP_SECRET OFFICE_AUTH_BREAK_GLASS_SECRET OFFICE_AUTH_EMAIL_DOMAIN
OFFICE_AUTH_SIGNING_SECRET OFFICE_FILE_SCAN_MAX_BYTES OFFICE_FILE_SCAN_TIMEOUT_SECONDS
OFFICE_MUTATION_RATE_LIMIT OFFICE_RATE_LIMIT_WINDOW_SECONDS OFFICE_REQUIRED_AAL
OIDC_ACTOR_CLAIM OIDC_AUDIENCE OIDC_ISSUER OIDC_JWKS_URL OIDC_REQUIRED_AAL
OIDC_ROLE_CLAIM PUBLIC_BASE_URL""".split())

WORKER_ONLY = set("""KRAVIA_CLAMAV_SELF_TEST_ATTEMPTS KRAVIA_CLAMAV_SELF_TEST_ON_STARTUP
KRAVIA_CLAMAV_SELF_TEST_RETRY_SECONDS KRAVIA_FILE_PIPELINE_SELF_TEST_ATTEMPTS
KRAVIA_FILE_PIPELINE_SELF_TEST_ON_STARTUP KRAVIA_FILE_PIPELINE_SELF_TEST_RETRY_SECONDS
KRAVIA_WORKER_BATCH_SIZE KRAVIA_WORKER_INTERVAL_SECONDS""".split())

SECURE = set("""BREVO_API_KEY DATABASE_URL GST_GSP_CLIENT_ID GST_GSP_CLIENT_SECRET
GST_GSP_USERNAME GST_GSTR1_CURRENT_YEAR_TURNOVER GST_GSTR1_PREV_YEAR_TURNOVER
KRAVIA_DB_BACKUP_KEY KRAVIA_PLAY_REVIEWER_EMAIL KRAVIA_PLAY_REVIEWER_OTP
KRAVIA_PLAY_REVIEWER_PASSWORD KRAVIA_PUBLIC_INTAKE_WEBHOOK_SECRET
KRAVIA_STORAGE_BROKER_KEY_A KRAVIA_STORAGE_BROKER_KEY_B
KRAVIA_STORAGE_BROKER_KEY_C KRAVIA_STORAGE_BROKER_PRIVATE_KEY
KRAVIA_STORAGE_BROKER_PRIVATE_KEY_B64 OFFICE_AUTH_BOOTSTRAP_SECRET
OFFICE_AUTH_BREAK_GLASS_SECRET OFFICE_AUTH_SIGNING_SECRET SUPABASE_POOLER_USER""".split())

KMS_KEY = "0d7820e2-bd32-48e4-8246-f0082aeebc04"
REGION = "ap-south-1"
NAME = re.compile(r"^[A-Z][A-Z0-9_]*$")


def validate_source() -> None:
    if SHARED & API_ONLY or SHARED & WORKER_ONLY or API_ONLY & WORKER_ONLY:
        raise RuntimeError("Invalid key scope mapping")
    if (MIGRATE | REVIEW | RECONFIGURE) != (SHARED | API_ONLY | WORKER_ONLY):
        raise RuntimeError("Incomplete or excessive key scope mapping")


def parameter_name(name: str) -> str:
    scope = "shared" if name in SHARED else ("api" if name in API_ONLY else "worker")
    return f"/kravia/prod/{scope}/{name}"


def selected_names(service: str, review: bool) -> list[str]:
    allowed = MIGRATE | (REVIEW if review else set())
    scopes = SHARED | (API_ONLY if service == "api" else WORKER_ONLY)
    return sorted(scopes & allowed)


def input_is_valid(value: str) -> bool:
    return bool(value) and "\x00" not in value and "\r" not in value and "\n" not in value and len(value.encode("utf-8")) <= 4096 and "${{" not in value


def check_target(session, expected_account: str) -> None:
    identity = session.client("sts").get_caller_identity()
    if identity["Account"] != expected_account:
        raise RuntimeError("AWS account mismatch; stopped before writing")
    key = session.client("kms", region_name=REGION).describe_key(KeyId=KMS_KEY)["KeyMetadata"]
    if (
        key.get("KeyManager") != "CUSTOMER"
        or key.get("KeyState") != "Enabled"
        or key.get("KeyUsage") != "ENCRYPT_DECRYPT"
        or key.get("KeySpec") != "SYMMETRIC_DEFAULT"
        or not key.get("Arn", "").startswith(f"arn:aws:kms:{REGION}:{expected_account}:")
    ):
        raise RuntimeError("KMS key is not an enabled customer-managed symmetric key in target account/region")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service", choices=("api", "worker"), required=True)
    parser.add_argument("--expected-account", help="12-digit AWS account; mandatory for --apply")
    parser.add_argument("--include-review", action="store_true", help="Requires separate policy review of legacy/regulatory switches")
    parser.add_argument("--apply", action="store_true", help="Write non-existing parameters to AWS")
    args = parser.parse_args()
    validate_source()
    if args.apply and not (args.expected_account and re.fullmatch(r"\d{12}", args.expected_account)):
        parser.error("--expected-account is required for --apply")
    names = selected_names(args.service, args.include_review)
    ready = [(name, os.environ[name]) for name in names if name in os.environ and input_is_valid(os.environ[name])]
    invalid = [name for name in names if name in os.environ and not input_is_valid(os.environ[name])]
    missing = [name for name in names if name not in os.environ]
    print(f"Source {args.service}: {len(names)} selected; {len(ready)} ready; {len(invalid)} invalid/oversize; {len(missing)} missing")
    for name in invalid:
        print("REVIEW invalid/multiline/oversize/unresolved:", parameter_name(name))
    for name in missing:
        print("MISSING:", parameter_name(name))
    if not args.apply:
        print("DRY RUN: no AWS writes. Railway variables have not been printed or saved.")
        return 0 if not invalid else 2
    if invalid or missing:
        print("No writes. Resolve invalid or missing selected values first.", file=sys.stderr)
        return 2
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        parser.error("Install boto3 privately: python -m pip install boto3")
    session = boto3.Session(region_name=REGION)
    check_target(session, args.expected_account)
    ssm = session.client("ssm", region_name=REGION)
    errors = 0
    for name, value in ready:
        path = parameter_name(name)
        parameter_type = "SecureString" if name in SECURE else "String"
        # Never overwrite existing parameters, even on repeat invocations.
        # For the worker's shared values, verify equality against API import without printing either value.
        try:
            existing = ssm.get_parameter(Name=path, WithDecryption=True)["Parameter"]
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") != "ParameterNotFound":
                print("ERROR (cannot check existing parameter):", path, file=sys.stderr)
                errors += 1
                continue
        else:
            if existing.get("Type") != parameter_type or existing.get("Value") != value:
                print("MISMATCH: existing AWS value or type differs; left unchanged:", path, file=sys.stderr)
                errors += 1
            else:
                print("MATCH (existing, not rewritten):", path)
            continue
        try:
            request = dict(Name=path, Value=value, Type=parameter_type, Tier="Standard", Overwrite=False)
            if parameter_type == "SecureString":
                request["KeyId"] = KMS_KEY
            ssm.put_parameter(**request)
            print("CREATED:", path, parameter_type)
        except ClientError:
            print("ERROR (AWS rejected write, value hidden):", path, file=sys.stderr)
            errors += 1
    print("Import complete. Only parameter names/statuses were printed.")
    return 1 if errors else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Import stopped ({type(exc).__name__}); no secrets printed.", file=sys.stderr)
        raise SystemExit(2)
