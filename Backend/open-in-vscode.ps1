$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command code -ErrorAction SilentlyContinue)) {
  Write-Host "VS Code command 'code' is not in PATH. Open VS Code and use File > Open Workspace from File, then choose KRAVIA-Office.code-workspace." -ForegroundColor Yellow
  exit 1
}
code .\KRAVIA-Office.code-workspace
