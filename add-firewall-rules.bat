@echo off
echo ========================================
echo Adding Windows Firewall Rules
echo ========================================
echo.

echo Adding rule for FastAPI Backend (Port 8000)...
netsh advfirewall firewall add rule name="FastAPI Backend Port 8000" dir=in action=allow protocol=TCP localport=8000
if %errorlevel% equ 0 (
    echo [SUCCESS] Port 8000 rule added
) else (
    echo [FAILED] Could not add port 8000 rule
)
echo.

echo Adding rule for Vite Miniapp (Port 5174)...
netsh advfirewall firewall add rule name="Vite Miniapp Port 5174" dir=in action=allow protocol=TCP localport=5174
if %errorlevel% equ 0 (
    echo [SUCCESS] Port 5174 rule added
) else (
    echo [FAILED] Could not add port 5174 rule
)
echo.

echo ========================================
echo Firewall rules added successfully!
echo ========================================
echo.
echo Your services should now be accessible at:
echo   - Backend API: http://192.168.0.240:8000
echo   - Miniapp:     http://192.168.0.240:5174
echo.
echo Press any key to exit...
pause >nul
