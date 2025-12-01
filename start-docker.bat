@echo off
setlocal enabledelayedexpansion

REM Ink and Arch Time Tracking System - Docker Only Version
REM Uses Node.js 22-alpine container exclusively

echo.
echo ========================================================
echo   🐳 Ink and Arch - Docker Node.js Starter  
echo ========================================================
echo.

REM Check if Docker is available
echo 🔍 Checking Docker availability...
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker not found!
    echo.
    echo 📥 Please install Docker Desktop:
    echo    1. Visit: https://www.docker.com/products/docker-desktop
    echo    2. Download and install Docker Desktop
    echo    3. Start Docker Desktop
    echo    4. Run this script again
    pause
    exit /b 1
)

echo ✅ Docker found!
echo.

REM Check if Docker daemon is running
echo 🔧 Checking Docker daemon...
docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Docker daemon not running!
    echo 💡 Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo ✅ Docker daemon is running
echo.

REM Pull Node.js Docker image
echo 📦 Pulling Node.js Docker image (node:22-alpine)...
docker pull node:22-alpine
if %errorlevel% neq 0 (
    echo ❌ Failed to pull Docker image
    echo 💡 Check your internet connection and Docker settings
    pause
    exit /b 1
)

echo ✅ Node.js Docker image ready
echo.

REM Verify Node.js and npm versions in container
echo 🔍 Verifying Node.js installation in container...
echo Node.js version:
docker run --rm node:22-alpine node -v
echo npm version:
docker run --rm node:22-alpine npm -v
echo.

REM Create data directory if it doesn't exist
if not exist "data" (
    echo 📁 Creating data directory...
    mkdir data
    echo ✅ Data directory created
)

REM Display startup information
echo 🚀 Starting Ink and Arch Time Tracking System...
echo.
echo 📋 Docker Configuration:
echo    - Image: node:22-alpine
echo    - Port: 3001 (mapped to host)
echo    - Volume: Current directory mounted to /app
echo    - Working Directory: /app
echo.

echo 🔄 Container will perform these steps:
echo    1. Install npm dependencies
echo    2. Start the application server
echo    3. If start fails, install express@latest
echo    4. Retry server start
echo.

REM Start the application in Docker container
echo ▶️  Starting container...
echo.

docker run -it --rm ^
    --name inkandarch-app ^
    -p 3001:3001 ^
    -v "%cd%":/app ^
    -w /app ^
    node:22-alpine sh -c "
        echo '===========================================' &&
        echo '🔧 Installing dependencies...' &&
        npm install &&
        echo '✅ Dependencies installed successfully' &&
        echo '===========================================' &&
        echo '🚀 Starting Ink and Arch server...' &&
        npm start || (
            echo '===========================================' &&
            echo '❌ npm start failed, diagnosing...' &&
            echo '🔧 Installing express@latest as fallback...' &&
            npm install express@latest &&
            echo '✅ Express installed' &&
            echo '🔄 Retrying server start...' &&
            npm start || (
                echo '❌ Server start failed again' &&
                echo '📋 Debug information:' &&
                echo 'Node.js version:' && node -v &&
                echo 'npm version:' && npm -v &&
                echo 'Package.json exists:' && ls -la package.json &&
                echo 'Dependencies installed:' && ls -la node_modules | head -5 &&
                exit 1
            )
        ) &&
        echo '===========================================' &&
        echo '🎉 Server started successfully!' &&
        echo '🌐 Access: http://localhost:3001' &&
        echo '🔑 Login: admin/admin, frontdesk/frontdesk, employee/employee' &&
        echo '🛑 Stop: Press Ctrl+C' &&
        echo '==========================================='
    "

REM Check if container exited successfully
if %errorlevel% equ 0 (
    echo.
    echo ✅ Container completed successfully
) else (
    echo.
    echo ❌ Container exited with errors
    echo.
    echo 🔧 Troubleshooting tips:
    echo    1. Check if port 3001 is available
    echo    2. Ensure package.json exists in current directory
    echo    3. Verify Docker has enough resources allocated
    echo    4. Check Docker Desktop logs for more details
)

echo.
echo 🌐 If successful, open: http://localhost:3001
echo.
echo Press any key to exit...
pause >nul
