@echo off
setlocal
cd /d "%~dp0"
if not exist ".local\cpu-env\Scripts\python.exe" (
  echo Verona's local Python environment is missing. Follow README.md setup first.
  pause
  exit /b 1
)
".local\cpu-env\Scripts\python.exe" -m verona.desktop
if errorlevel 1 pause
