$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
python -m pip install -r backend/requirements.txt
Write-Host "Running tests..." -ForegroundColor Cyan
python -m pytest -q
Write-Host "Running quality gate..." -ForegroundColor Cyan
python scripts/quality_gate.py
Write-Host "Starting API on http://127.0.0.1:8000" -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$PSScriptRoot'; python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"
Write-Host "Starting web on http://127.0.0.1:8123" -ForegroundColor Green
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$PSScriptRoot'; python -m http.server 8123"
