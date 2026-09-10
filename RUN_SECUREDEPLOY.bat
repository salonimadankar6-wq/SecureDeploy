@echo off
title SecureDeploy

cd /d "%~dp0"

echo Starting SecureDeploy Backend...
start "SecureDeploy Backend" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

timeout /t 4 /nobreak >nul

echo Starting SecureDeploy Frontend...
start "SecureDeploy Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1"

timeout /t 7 /nobreak >nul

start "" "http://localhost:5173"

exit