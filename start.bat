@echo off
setlocal enabledelayedexpansion

REM Ink and Arch Time Tracking System - Comprehensive Starter
REM Handles Node.js installation via Docker or local installation

echo.
echo ========================================================
echo   🚀 Ink and Arch Time Tracking System Starter
echo ========================================================
echo.

REM Check if Node.js is already installed locally
echo 🔍 Checking for local Node.js installation...
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ Local Node.js found!
    echo Node.js version:
    node -v
    echo npm version:
    npm -v
    echo.
    goto :start_app_local
)

echo ❌ Local Node.js not found.
echo.

REM Check if Docker is available
echo 🐳 Checking for Docker...
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker not found either.
    echo.
    echo 📥 Please install Node.js manually:
    echo    1. Visit: https://nodejs.org/
    echo    2. Download Node.js 16.0.0 or higher
    echo    3. Run the installer
    echo    4. Restart this script
    echo.
    echo    OR install Docker Desktop to use containerized Node.js
    pause
    exit /b 1
)

echo ✅ Docker found! Using Docker for Node.js...
echo.

REM Pull Node.js Docker image
echo 📦 Pulling Node.js Docker image...
docker pull node:22-alpine
if %errorlevel% neq 0 (
    echo ❌ Failed to pull Docker image
    echo 💡 Make sure Docker is running and you have internet connection
    pause
    exit /b 1
)

echo ✅ Node.js Docker image ready
echo.

REM Create a container and verify versions
echo 🔧 Verifying Node.js in container...
docker run --rm node:22-alpine node -v
docker run --rm node:22-alpine npm -v
echo.

REM Run the application in Docker container
echo 🚀 Starting application in Docker container...
echo.
echo 📋 Container will:
echo    - Mount current directory to /app
echo    - Install dependencies automatically
echo    - Start the server on port 3001
echo    - Map port 3001 to host
echo.

REM Check if data directory exists, create if not
if not exist "data" (
    echo 📁 Creating data directory...
    mkdir data
)

REM Start the application in Docker
docker run -it --rm ^
    -p 3001:3001 ^
    -v "%cd%":/app ^
    -w /app ^
    node:22-alpine sh -c "
        echo '🔧 Installing dependencies...' && 
        npm install && 
        echo '✅ Dependencies installed' && 
        echo '🚀 Starting server...' && 
        npm start || (
            echo '❌ npm start failed, trying to install express...' && 
            npm install express@latest && 
            echo '🔄 Retrying server start...' && 
            npm start
        )
    "

goto :end

:start_app_local
echo.
echo 🚀 Starting application with local Node.js...
echo.

REM Check if we're in the correct directory
if not exist "package.json" (
    echo ❌ package.json not found in current directory
    echo 💡 Make sure you're in the InkAndArch/public directory
    echo Current directory: %cd%
    pause
    exit /b 1
)

REM Check if data directory exists
if not exist "data" (
    echo 📁 Creating data directory...
    mkdir data
    echo ✅ Data directory created
)

REM Always try to install/update dependencies
echo 📦 Installing/updating dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ npm install failed
    echo 💡 Trying to fix with cache clean...
    npm cache clean --force
    npm install
    if %errorlevel% neq 0 (
        echo ❌ npm install still failed
        echo.
        echo 🔧 Troubleshooting tips:
        echo    1. Check your internet connection
        echo    2. Make sure you have write permissions
        echo    3. Try running as administrator
        pause
        exit /b 1
    )
)
echo ✅ Dependencies ready

REM Start the application
echo.
echo 🚀 Starting server...
npm start
if %errorlevel% neq 0 (
    echo ❌ npm start failed, trying to install express...
    npm install express@latest
    if %errorlevel% neq 0 (
        echo ❌ Failed to install express
        pause
        exit /b 1
    )
    echo 🔄 Retrying server start...
    npm start
    if %errorlevel% neq 0 (
        echo ❌ Server failed to start
        echo.
        echo 🔧 Troubleshooting tips:
        echo    1. Check if port 3001 is already in use
        echo    2. Try: npx kill-port 3001
        echo    3. Check the error messages above
        echo    4. Ensure all files are in the correct location
        pause
        exit /b 1
    )
)

:end
echo.
echo ========================================================
echo   🎉 Application should now be running!
echo ========================================================
echo.
echo 🌐 Access the application at: http://localhost:3001
echo.
echo 🔑 Default login credentials:
echo    Admin:      username: admin,     password: admin
echo    Front Desk: username: frontdesk, password: frontdesk  
echo    Employee:   username: employee,  password: employee
echo.
echo ⚠️  Important: Change default passwords in production!
echo.
echo 🛑 To stop the server: Press Ctrl+C
echo.

REM Try to open browser automatically
echo 🌐 Opening browser...
timeout /t 3 /nobreak >nul
start "" "http://localhost:3001"

echo.
echo Press any key to exit...
pause >nul
