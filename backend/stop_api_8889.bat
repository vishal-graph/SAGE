@echo off
cd /d "%~dp0"
echo Stopping processes that are LISTENING on port 8889 (SIGE API)...
set "FOUND="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8889" ^| findstr LISTENING') do (
  set "FOUND=1"
  echo   taskkill /PID %%P /F
  taskkill /PID %%P /F 2>nul
)
if not defined FOUND echo   (none found — port 8889 is free)
echo.
echo Now run run_api.bat or: npm run dev
pause
