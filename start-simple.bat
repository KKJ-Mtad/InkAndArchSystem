@echo off
setlocal enabledelayedexpansion

REM Ink and Arch Time Tracking System - Simple Local Starter

echo.
echo ========================================================
echo   🚀 Ink and Arch Time Tracking System
echo ========================================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ package.json not found!
    echo 💡 Please navigate to the InkAndArch/public directory first
    echo    Example: cd path\to\InkAndArch\public
    echo.
    pause
    exit /b 1
)

REM Check if Node.js is installed
echo 🔍 Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js not found!
    echo.
    echo 📥 Please install Node.js:
    echo    1. Visit: https://nodejs.org/
    echo    2. Download and install Node.js 16.0.0 or higher
    echo    3. Restart your command prompt
    echo    4. Run this script again
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js found!
node -v
npm -v
echo.

REM Create data directory if needed
if not exist "data" (
    echo 📁 Creating data directory...
    mkdir data
    echo ✅ Data directory created
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ npm install failed
    echo 🔧 Trying to fix...
    npm cache clean --force
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Still failed. Please check your internet connection
        pause
        exit /b 1
    )
)

echo ✅ Dependencies installed
echo.

REM Start the server
echo 🚀 Starting server...
npm start
if %errorlevel% neq 0 (
    echo ❌ Server failed to start
    echo 🔧 Trying fallback method...
    npm install express@latest
    if %errorlevel% neq 0 (
        echo ❌ Failed to install express
        pause
        exit /b 1
    )
    echo 🔄 Retrying server start...
    npm start
    if %errorlevel% neq 0 (
        echo ❌ Server still won't start
        echo.
        echo 🔧 Common solutions:
        echo    1. Check if port 3001 is already in use
        echo    2. Run: npx kill-port 3001
        echo    3. Make sure all files are present
        pause
        exit /b 1
    )
)

REM Success message
echo.
echo ========================================================
echo   🎉 Server Started Successfully!
echo ========================================================
echo.
echo 🌐 Access the application: http://localhost:3001
echo.
echo 🔑 Default credentials:
echo    Admin:      admin / admin
echo    Front Desk: frontdesk / frontdesk
echo    Employee:   employee / employee
echo.
echo ⚠️  Change default passwords in production!
echo.
echo 🛑 To stop: Press Ctrl+C
echo.

REM Try to open browser
echo 🌐 Opening browser...
timeout /t 2 /nobreak >nul
start "" "http://localhost:3001"

echo Press any key to exit...
pause >nul
