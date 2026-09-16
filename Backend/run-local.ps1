$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
python -m pip install -r backend/requirements.txt

Write-Host "Applying database migrations..." -ForegroundColor Cyan
alembic upgrade head

Write-Host "Running Office tests..." -ForegroundColor Cyan
python -m pytest backend/tests -q

Write-Host "Verifying OpenAPI contract..." -ForegroundColor Cyan
python scripts/export_openapi.py --check

Write-Host "Running quality gate..." -ForegroundColor Cyan
python scripts/quality_gate.py

Write-Host "Starting canonical KRAVIA Office on http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "The API and Office web UI are served from the same origin." -ForegroundColor Green
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload
