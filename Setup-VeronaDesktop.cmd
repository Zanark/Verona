@echo off
setlocal
cd /d "%~dp0"
echo This explicitly downloads the pinned official Electron runtime into this repository.
echo No global installation, model download, startup service or browser profile change.
set ELECTRON_MIRROR=
set ELECTRON_CUSTOM_DIR=
set ELECTRON_CUSTOM_FILENAME=
set ELECTRON_SKIP_BINARY_DOWNLOAD=
set ELECTRON_OVERRIDE_DIST_PATH=
set ELECTRON_INSTALL_PLATFORM=
set ELECTRON_INSTALL_ARCH=
set ELECTRON_GET_USE_PROXY=
set electron_use_remote_checksums=
set npm_config_electron_use_remote_checksums=
set NODE_OPTIONS=
set electron_config_cache=%CD%\.local\electron-cache
call npm ci --prefix desktop --cache .local\npm-cache --ignore-scripts --no-audit --no-fund
if errorlevel 1 exit /b 1
node desktop\node_modules\electron\install.js
if errorlevel 1 exit /b 1
echo Desktop runtime ready. Run VeronaDesktop.cmd.
