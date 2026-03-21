@echo off
setlocal EnableExtensions

rem OpenClaw UI — Windows: install deps, build, serve dist (static).
rem Run from anywhere:  scripts\setup-and-serve.cmd
rem Optional: set PORT=8080 before running (default 4173).
rem Optional: set GIT_PULL=1 to run "git pull" first (needs git in PATH).

cd /d "%~dp0.."
if not exist "package.json" (
  echo ERROR: package.json not found. Clone openclaw-ui and run this from the repo.
  exit /b 1
)

if "%PORT%"=="" set "PORT=4173"

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found. Install Node.js LTS from https://nodejs.org/
  exit /b 1
)

if /i "%GIT_PULL%"=="1" (
  where git >nul 2>&1
  if errorlevel 1 (
    echo ERROR: GIT_PULL=1 but git not found.
    exit /b 1
  )
  echo [openclaw-ui] git pull...
  call git pull
  if errorlevel 1 exit /b 1
)

echo [openclaw-ui] npm install...
call npm install
if errorlevel 1 exit /b 1

echo [openclaw-ui] npm run build...
call npm run build
if errorlevel 1 exit /b 1

echo [openclaw-ui] Serving on http://localhost:%PORT%/ ^(all interfaces — use this PC's LAN IP from other devices^)
echo [openclaw-ui] Ctrl+C to stop.
call npx --yes serve dist -s -l tcp://0.0.0.0:%PORT% --no-clipboard
exit /b %errorlevel%
