.PHONY: install test quality migrate run evidence
install:
	python -m pip install -r backend/requirements.txt
migrate:
	alembic upgrade head
run:
	python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
test:
	python -m pytest -q
quality:
	python scripts/quality_gate.py
evidence:
	python scripts/generate_inspection_pack.py --authority INTERNAL_AUDIT --reference FINAL-HANDOVER
