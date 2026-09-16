#!/usr/bin/env python3
"""Generate or verify the committed KRAVIA Office OpenAPI contract."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app import app  # noqa: E402

TARGET = ROOT / "spec" / "api" / "openapi.json"


def rendered_spec() -> str:
    return json.dumps(app.openapi(), indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Export or verify the KRAVIA Office OpenAPI contract")
    parser.add_argument("--check", action="store_true", help="fail if the committed spec differs from the application")
    args = parser.parse_args()

    generated = rendered_spec()
    if args.check:
        existing = TARGET.read_text(encoding="utf-8") if TARGET.exists() else ""
        if existing != generated:
            print(f"OpenAPI contract drift detected: {TARGET.relative_to(ROOT)}")
            print("Run: python scripts/export_openapi.py")
            return 1
        print(f"OpenAPI contract is current: {TARGET.relative_to(ROOT)}")
        return 0

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(generated, encoding="utf-8")
    print(f"Wrote {TARGET.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
