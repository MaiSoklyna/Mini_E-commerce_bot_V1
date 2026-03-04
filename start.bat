@echo off
title Favourite Shop Launcher

echo =============================================
echo   FAVOURITE SHOP - Starting All Services
echo =============================================
echo.
echo  [1] API + Bot       ^>  http://192.168.0.240:8000
echo  [2] Dashboard       ^>  http://localhost:5173
echo  [3] Miniapp         ^>  http://192.168.0.240:5174
echo.

REM Start API + Bot combined (ONE window only - prevents 409 conflicts)
start "API + Bot - Favourite Shop" cmd /k "title API + Bot - Favourite Shop && cd /d "%~dp0backend" && echo. && echo  Starting API + Bot on http://0.0.0.0:8000 && echo. && py -3.13 run.py"

REM Start Dashboard
start "Dashboard - Favourite Shop" cmd /k "title Dashboard - Favourite Shop && cd /d "%~dp0dashboard" && echo. && echo  Starting Dashboard on http://localhost:5173 && echo. && npm run dev"

REM Start Miniapp (Telegram WebApp)
start "Miniapp - Favourite Shop" cmd /k "title Miniapp - Favourite Shop && cd /d "%~dp0miniapp" && echo. && echo  Starting Miniapp on http://0.0.0.0:5174 && echo. && npm run dev"

echo.
echo  All 3 services are starting in separate windows.
echo  API and Bot run together in ONE process (no more 409 errors!)
echo  You can close this window.
echo.
timeout /t 4 >nul
