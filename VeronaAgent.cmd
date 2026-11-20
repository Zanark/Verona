@echo off
setlocal
cd /d "%~dp0"
if not exist ".local\cpu-env\Scripts\python.exe" (
  echo Verona's local Python environment is missing. Follow README.md setup first. 1>&2
  exit /b 1
)
".local\cpu-env\Scripts\python.exe" -m verona.agent %*
exit /b %errorlevel%
