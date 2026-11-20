"""Offline guardrail tests for Railway -> AWS import (no AWS/Railway access)."""
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("railway_to_ssm", Path(__file__).with_name("railway_env_to_ssm.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RailwayMigrationTests(unittest.TestCase):
    def test_all_scopes_partition_exactly(self):
        module.validate_source()
        self.assertEqual(len(module.MIGRATE), 58)
        self.assertEqual(len(module.REVIEW), 15)
        self.assertEqual(len(module.RECONFIGURE), 6)
        self.assertEqual(len(module.MIGRATE | module.REVIEW | module.RECONFIGURE), 79)

    def test_scope_and_secret_routing(self):
        self.assertEqual(module.parameter_name("DATABASE_URL"), "/kravia/prod/shared/DATABASE_URL")
        self.assertEqual(module.parameter_name("OFFICE_AUTH_SIGNING_SECRET"), "/kravia/prod/api/OFFICE_AUTH_SIGNING_SECRET")
        self.assertEqual(module.parameter_name("KRAVIA_WORKER_INTERVAL_SECONDS"), "/kravia/prod/worker/KRAVIA_WORKER_INTERVAL_SECONDS")
        self.assertIn("DATABASE_URL", module.SECURE)

    def test_review_and_reconfiguration_separate(self):
        self.assertNotIn("FINANCE_EXECUTION_MODE", module.selected_names("api", False))
        self.assertIn("FINANCE_EXECUTION_MODE", module.selected_names("api", True))
        self.assertNotIn("OFFICE_ALLOWED_HOSTS", module.selected_names("api", True))

    def test_does_not_touch_railway_metadata(self):
        self.assertNotIn("PORT", module.MIGRATE | module.REVIEW)
        self.assertFalse(any(name.startswith("RAILWAY_") for name in module.MIGRATE | module.REVIEW))
        self.assertNotIn("KRAVIA_API_DEPLOYMENT_GENERATION", module.MIGRATE | module.REVIEW)

    def test_invalid_values_are_skipped(self):
        for value in ("", "contains\nnewline", "contains\x00nul", "${{Database.DATABASE_URL}}", "x"*4097):
            with self.subTest(label=len(value)):
                self.assertFalse(module.input_is_valid(value))
        self.assertTrue(module.input_is_valid("value$with=punctuation"))

    def test_empty_values_are_skipped_but_malformed_values_block(self):
        ready, empty, invalid, missing = module.classify_inputs(
            ["GOOD", "EMPTY", "BAD", "MISSING"],
            {"GOOD": "safe", "EMPTY": "", "BAD": "bad\nvalue"},
        )
        self.assertEqual(ready, [("GOOD", "safe")])
        self.assertEqual(empty, ["EMPTY"])
        self.assertEqual(invalid, ["BAD"])
        self.assertEqual(missing, ["MISSING"])


if __name__ == "__main__":
    unittest.main()
