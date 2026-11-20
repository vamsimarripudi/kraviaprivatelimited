"""Static safety checks for the Hyderabad migration artifacts.

These tests deliberately avoid AWS credentials and network access. Live resource
state, key policies, and deployment health require a separately authenticated
operator session.
"""
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


class HyderabadInfrastructureTests(unittest.TestCase):
  def test_all_migration_defaults_target_hyderabad(self):
    paths = [
        "infra/aws/ec2/railway_env_to_ssm.py",
        "infra/aws/ec2/ssm_to_env.py",
        "infra/aws/ec2/deploy.sh",
        "infra/aws/ec2/compose.yaml",
        ".github/workflows/aws-ec2-deploy.yml",
        "docs/aws-migration/FOUR_PART_PLAN.md",
        "docs/aws-migration/CODEX_HANDOFF.md",
        "docs/aws-migration/CODEX_FULL_EXECUTION.md",
    ]
    for path in paths:
      contents = read(path)
      self.assertNotIn("ap-south-1", contents, path)
      self.assertIn("ap-south-2", contents, path)


  def test_compose_has_private_runtime_guards(self):
    compose = read("infra/aws/ec2/compose.yaml")
    self.assertEqual(compose.count("no-new-privileges:true"), 2)
    self.assertEqual(compose.count("condition: service_healthy"), 2)
    self.assertEqual(compose.count("awslogs-create-group: \"false\""), 3)
    self.assertIn("clamav-signatures", compose)


  def test_deploy_workflow_is_hyd_and_ssm_only(self):
    workflow = read(".github/workflows/aws-ec2-deploy.yml")
    self.assertIn("aws-region: ap-south-2", workflow)
    self.assertIn("aws ssm send-command", workflow)
    self.assertIn("aws ec2 describe-instances", workflow)
    self.assertNotIn("aws_access_key_id", workflow)


  def test_terraform_fails_closed_for_region_and_public_ssh(self):
    variables = read("infra/aws/terraform/variables.tf")
    main = read("infra/aws/terraform/main.tf")
    self.assertIn('condition     = var.region == "ap-south-2"', variables)
    self.assertIn('importer_principal_arn', variables)
    self.assertIn('from_port   = 443', main)
    self.assertIn('from_port       = 8000', main)
    self.assertNotIn('from_port   = 22', main)


if __name__ == "__main__":
  unittest.main()
