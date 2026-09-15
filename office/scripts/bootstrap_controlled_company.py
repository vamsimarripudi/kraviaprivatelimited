#!/usr/bin/env python3
"""Apply a git-ignored controlled company/shareholding bootstrap file."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from backend.controlled_bootstrap import apply_controlled_config, load_controlled_config
from backend.database import SessionLocal


def main() -> int:
    parser = argparse.ArgumentParser(description="Load controlled KRAVIA company/shareholding data")
    parser.add_argument("--config", default="config/company-master.local.json")
    parser.add_argument("--actor", default=os.getenv("OFFICE_BOOTSTRAP_ACTOR", "Controlled Bootstrap"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    app_env = os.getenv("APP_ENV", "development").lower()
    if app_env == "production" and os.getenv("CONTROLLED_BOOTSTRAP_APPROVED", "").lower() != "true":
        print("Production bootstrap blocked. Set CONTROLLED_BOOTSTRAP_APPROVED=true only after evidence review.", file=sys.stderr)
        return 2

    config_path = Path(args.config)
    config = load_controlled_config(config_path)
    preview = {
        "config": str(config_path),
        "legal_entity": config["legal_entity"]["legal_name"],
        "cin": config["legal_entity"]["cin"],
        "share_classes": len(config.get("share_classes", [])),
        "shareholders": len(config.get("shareholders", [])),
        "initial_allocations": len(config.get("initial_allocations", [])),
        "dry_run": args.dry_run,
    }
    print(json.dumps(preview, indent=2))
    if args.dry_run:
        return 0

    db = SessionLocal()
    try:
        result = apply_controlled_config(db, config, actor=args.actor)
        print(json.dumps({"status": "applied", **result}, indent=2))
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Controlled bootstrap failed: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
