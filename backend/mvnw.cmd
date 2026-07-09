@echo off
setlocal

set "BASE_DIR=%~dp0"
set "WRAPPER_DIR=%BASE_DIR%.mvn\wrapper"
set "PROPERTIES_FILE=%WRAPPER_DIR%\maven-wrapper.properties"
set "DIST_ROOT=%WRAPPER_DIR%\dists"

if not exist "%PROPERTIES_FILE%" (
  echo Missing Maven Wrapper properties: %PROPERTIES_FILE% 1>&2
  exit /b 1
)

for /f "tokens=1,* delims==" %%A in ('findstr /b "distributionUrl=" "%PROPERTIES_FILE%"') do set "DIST_URL=%%B"
if "%DIST_URL%"=="" (
  echo Missing distributionUrl in %PROPERTIES_FILE% 1>&2
  exit /b 1
)

for %%F in ("%DIST_URL%") do set "DIST_FILE=%%~nxF"
set "DIST_NAME=%DIST_FILE:-bin.zip=%"
set "DIST_DIR=%DIST_ROOT%\%DIST_NAME%"
set "DIST_ZIP=%DIST_ROOT%\%DIST_FILE%"

if not exist "%DIST_DIR%\bin\mvn.cmd" (
  if not exist "%DIST_ROOT%" mkdir "%DIST_ROOT%"

  if not exist "%DIST_ZIP%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '%DIST_URL%' -OutFile '%DIST_ZIP%'"
    if errorlevel 1 exit /b %errorlevel%
  )

  if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%DIST_ZIP%' -DestinationPath '%DIST_ROOT%' -Force"
  if errorlevel 1 exit /b %errorlevel%
)

call "%DIST_DIR%\bin\mvn.cmd" %*
exit /b %errorlevel%
