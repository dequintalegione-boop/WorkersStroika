@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR (
  echo Could not detect the Node.js version.
  pause
  exit /b 1
)
if %NODE_MAJOR% LSS 22 (
  echo Node.js 22 or newer is required. Current major version: %NODE_MAJOR%.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing project dependencies...
  call npm ci
  if errorlevel 1 goto failed
)

echo Starting local WorkersStroika...
start "WorkersStroika local server" cmd /k "cd /d ""%~dp0"" && npm run local"

echo Waiting for the local server...
for /l %%i in (1,1,120) do (
  curl.exe --silent --fail http://127.0.0.1:4173/ -o NUL >nul 2>&1
  if not errorlevel 1 goto ready
  timeout /t 1 /nobreak >nul
)

echo The local server did not start. Check the server window for errors.
pause
exit /b 1

:ready
start "" "http://127.0.0.1:4173/"
exit /b 0

:failed
echo Could not install dependencies.
pause
exit /b 1
