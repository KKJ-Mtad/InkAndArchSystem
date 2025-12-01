@echo off
REM Ink and Arch - Portable Server Startup Script
REM This script works regardless of folder location or name

REM Get the directory where this script is located
cd /d "%~dp0"

REM Display current working directory
echo Current directory: %cd%
echo.

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Starting Ink and Arch Server...
echo.

REM Start the server in the background
start "" cmd /c "npm start"

REM Wait for the server to start (5 seconds)
echo Waiting for server to start...
timeout /t 5 /nobreak >nul

REM Open the frontend automatically
echo Opening dashboard in browser...
start "" "http://localhost:3001"

echo.
echo Server started successfully!
echo Dashboard opened at http://localhost:3001
echo.
pause
