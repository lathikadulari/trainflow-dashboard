@echo off
echo ========================================
echo   Starting TrainFlow Dashboard
echo ========================================
echo.

:: Check if MongoDB service is running
echo Checking MongoDB service...
sc query MongoDB | find "RUNNING" > nul
if %errorlevel% neq 0 (
    echo MongoDB is not running. Starting MongoDB service...
    echo [This may require administrator privileges]
    net start MongoDB
    if %errorlevel% neq 0 (
        echo.
        echo WARNING: Could not start MongoDB service automatically.
        echo Please run this script as Administrator, or start MongoDB manually:
        echo   1. Open Services (services.msc)
        echo   2. Find "MongoDB" and click "Start"
        echo.
        pause
    ) else (
        echo MongoDB service started successfully!
    )
) else (
    echo MongoDB is already running.
)
echo.

:: Wait a moment for MongoDB to be ready
timeout /t 2 /nobreak > nul

:: Start Backend Server in a new window
echo Starting Backend Server...
start "TrainFlow Backend" cmd /k "cd /d %~dp0server && npm run dev"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak > nul

:: Start Frontend Server in a new window
echo Starting Frontend Server...
start "TrainFlow Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo ========================================
echo   All services are starting!
echo ========================================
echo   MongoDB:  Running locally
echo   Backend:  http://localhost:5001
echo   Frontend: http://localhost:8080
echo ========================================
echo.
echo Press any key to close this window...
pause > nul
