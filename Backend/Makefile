.PHONY: install migrate run test openapi quality evidence

install:
	python -m pip install -r backend/requirements.txt

migrate:
	alembic upgrade head

run:
	python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload

test:
	python -m pytest backend/tests -q

openapi:
	python scripts/export_openapi.py --check

quality:
	python scripts/quality_gate.py

evidence:
	python scripts/generate_inspection_pack.py --authority INTERNAL_AUDIT --reference FINAL-HANDOVER
