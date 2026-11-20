#!/usr/bin/env python3
"""Sync scoped SSM parameters to root-only Docker Compose raw env files.

Requires AWS CLI v2, EC2 IAM GetParametersByPath, KMS Decrypt.
Never log parameter values.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from pathlib import Path

NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
SCOPES = {"api": ("shared", "api"), "worker": ("shared", "worker")}
REQUIRED = {
    "api": {"APP_ENV", "DATABASE_URL", "DATABASE_EXECUTION_ROLE", "AUTH_MODE", "OFFICE_AUTH_SIGNING_SECRET"},
    "worker": {"APP_ENV", "DATABASE_URL", "DATABASE_EXECUTION_ROLE"},
}


def read_scope(root: str, scope: str, region: str) -> dict[str, str]:
    result = subprocess.run(
        ["aws", "ssm", "get-parameters-by-path", "--path", f"{root}/{scope}",
         "--recursive", "--with-decryption", "--region", region, "--output", "json"],
        check=True, capture_output=True, text=True,
    )
    values: dict[str, str] = {}
    prefix = f"{root}/{scope}/"
    for item in json.loads(result.stdout).get("Parameters", []):
        path = item["Name"]
        if not path.startswith(prefix) or "/" in path[len(prefix):]:
            raise ValueError("Unexpected nested SSM parameter path")
        name = path[len(prefix):]
        if not NAME.fullmatch(name):
            raise ValueError(f"Invalid parameter name: {name!r}")
        value = item["Value"]
        if any(character in value for character in ("\x00", "\r", "\n")):
            raise ValueError(f"Multiline parameter {name}: use base64 or approved file adapter")
        values[name] = value
    return values


def write_env(path: Path, values: dict[str, str]) -> None:
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(path.parent, 0o700)
    temporary = path.with_suffix(".tmp")
    fd = os.open(temporary, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as output:
        for name, value in sorted(values.items()):
            output.write(f"{name}={value}\n")
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)
    os.chmod(path, 0o600)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--region", default="ap-south-1")
    parser.add_argument("--root", default="/kravia/prod")
    parser.add_argument("--destination", default="/etc/kravia")
    arguments = parser.parse_args()
    if os.geteuid() != 0:
        parser.error("Must run as root; configuration contains production secrets")
    os.umask(0o077)
    root = arguments.root.rstrip("/")
    resolved: dict[str, dict[str, str]] = {}
    for service, scopes in SCOPES.items():
        combined: dict[str, str] = {}
        for scope in scopes:
            for name, value in read_scope(root, scope, arguments.region).items():
                if name in combined:
                    raise ValueError(f"Duplicate parameter {name} in {service} scopes")
                combined[name] = value
        missing = REQUIRED[service] - {name for name, value in combined.items() if value}
        if missing:
            raise ValueError(f"Missing required {service} parameters: {', '.join(sorted(missing))}")
        if combined["APP_ENV"] != "production":
            raise ValueError("Production APP_ENV must be production")
        if service == "api" and combined["AUTH_MODE"] != "first_party":
            raise ValueError("Production AUTH_MODE must be first_party")
        resolved[service] = combined
    destination = Path(arguments.destination)
    for service, values in resolved.items():
        write_env(destination / f"{service}.env", values)
    print("SSM configuration loaded into restricted env files; values hidden")


if __name__ == "__main__":
    main()
