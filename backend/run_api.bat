@echo off
cd /d "%~dp0"

REM Default 8889 avoids another old uvicorn still holding 8888.
REM Optional: run_api.bat 8888
set "SIGE_PORT=8889"
if not "%~1"=="" set "SIGE_PORT=%~1"

echo.
echo === SIGE API (must run from THIS folder) ===
echo Folder: %CD%
echo Port:   %SIGE_PORT%
echo.
python -c "import app.routers.ai as m; print('ai.py file:', m.__file__)"
if errorlevel 1 (
  echo Python could not import app.routers.ai — use: cd backend  then run this bat again.
  pause
  exit /b 1
)
echo.
echo Starting http://127.0.0.1:%SIGE_PORT%  (Ctrl+C to stop)
echo Open http://127.0.0.1:%SIGE_PORT%/health — ai_clean_floorplan_image should be true.
echo If bind fails, another app uses this port: run stop_api_8889.bat  OR  run_api.bat 8890  and set VITE_API_URL to match.
echo.
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port %SIGE_PORT%
pause
