@echo off
setlocal
cd /d "%~dp0"
if not exist ".local\cpu-env\Scripts\python.exe" (
  echo Missing CPU environment. Follow docs\prototype-guide.md first.
  exit /b 1
)
".local\cpu-env\Scripts\python.exe" -m scripts.mpfb_speaking_study %*
