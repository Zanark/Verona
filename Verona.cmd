@echo off
setlocal
cd /d "%~dp0"
if not exist ".local\cpu-env\Scripts\python.exe" (
  echo Verona's local environment is missing. Follow README.md setup first.
  pause
  exit /b 1
)
".local\cpu-env\Scripts\python.exe" -m verona.manager
if errorlevel 1 pause
