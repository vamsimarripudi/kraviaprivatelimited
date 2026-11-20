"""Offline tests for EC2 Parameter Store loading. No AWS credentials required."""
from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("ssm_to_env.py")
spec = importlib.util.spec_from_file_location("ssm_to_env", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)


class ParameterStoreTests(unittest.TestCase):
    def test_scope_loads_names_and_preserves_equals(self):
        payload = {"Parameters": [
            {"Name": "/kravia/prod/shared/DATABASE_URL", "Value": "postgresql://a:p@host/db?sslmode=require"},
            {"Name": "/kravia/prod/shared/OFFICE_AUTH_SIGNING_SECRET", "Value": "x=abc$test"},
        ]}
        with patch.object(module.subprocess, "run") as run:
            run.return_value.stdout = json.dumps(payload)
            loaded = module.read_scope("/kravia/prod", "shared", "ap-south-1")
        self.assertEqual(loaded["OFFICE_AUTH_SIGNING_SECRET"], "x=abc$test")
        self.assertEqual(len(loaded), 2)
        self.assertIn("--with-decryption", run.call_args.args[0])

    def test_rejects_nested_or_invalid_name(self):
        for name in ("nested/KEY", "BAD-KEY", "../SECRET"):
            with self.subTest(name=name):
                payload = {"Parameters": [{"Name": "/kravia/prod/api/" + name, "Value": "value"}]}
                with patch.object(module.subprocess, "run") as run:
                    run.return_value.stdout = json.dumps(payload)
                    with self.assertRaises(ValueError):
                        module.read_scope("/kravia/prod", "api", "ap-south-1")

    def test_rejects_multiline_and_nul(self):
        for value in ("one\ntwo", "one\rtwo", "one\x00two"):
            with self.subTest(value=repr(value)):
                payload = {"Parameters": [{"Name": "/kravia/prod/api/TOKEN", "Value": value}]}
                with patch.object(module.subprocess, "run") as run:
                    run.return_value.stdout = json.dumps(payload)
                    with self.assertRaises(ValueError):
                        module.read_scope("/kravia/prod", "api", "ap-south-1")

    def test_write_is_private_and_preserves_dollar(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "private" / "api.env"
            module.write_env(path, {"TOKEN": "abc$xyz", "FLAG": "enabled"})
            self.assertEqual(path.read_text(), "FLAG=enabled\nTOKEN=abc$xyz\n")
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
            self.assertEqual(os.stat(path.parent).st_mode & 0o777, 0o700)

    def test_aws_access_failure_propagates(self):
        with patch.object(module.subprocess, "run", side_effect=module.subprocess.CalledProcessError(1, ["aws"])):
            with self.assertRaises(module.subprocess.CalledProcessError):
                module.read_scope("/kravia/prod", "api", "ap-south-1")


if __name__ == "__main__":
    unittest.main()
