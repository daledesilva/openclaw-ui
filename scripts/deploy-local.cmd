@echo off
setlocal EnableExtensions

rem Sync repo to origin/main and rebuild dist/ (OpenClaw host). Destructive: git reset --hard.

cd /d "%~dp0.."
if not exist "package.json" (
  echo ERROR: package.json not found.
  exit /b 1
)

call npm run deploy:local
exit /b %errorlevel%
