@echo off
REM Ink and Arch Time Tracking System - Windows Setup Script

echo 🚀 Ink and Arch Time Tracking System Setup
echo ===========================================

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 16.0.0 or higher
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected
node -v

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm
    pause
    exit /b 1
)

echo ✅ npm detected
npm -v

REM Create data directory if it doesn't exist
if not exist "data" (
    echo 📁 Creating data directory...
    mkdir data
    echo ✅ Data directory created
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    echo 💡 Try running: npm cache clean --force
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo ⚙️ Creating default .env configuration...
    (
        echo # Ink and Arch Time Tracking Configuration
        echo PORT=3001
        echo NODE_ENV=development
        echo.
        echo # MongoDB ^(Optional - leave empty to use SQLite only^)
        echo MONGODB_URI=
        echo MONGODB_DB_NAME=inkandarch
        echo.
        echo # Security ^(Change these in production^)
        echo SESSION_SECRET=change-this-in-production
    ) > .env
    echo ✅ Default .env file created
)

echo.
echo 🎉 Setup completed successfully!
echo.
echo 📋 Next steps:
echo 1. Start the application: npm start
echo.
echo 2. Open your browser to: http://localhost:3001
echo.
echo 3. Login with default credentials:
echo    Admin:      username: admin,     password: admin
echo    Front Desk: username: frontdesk, password: frontdesk
echo    Employee:   username: employee,  password: employee
echo.
echo ⚠️  Important: Change default passwords in production!
echo.
echo 📚 For detailed documentation, see SETUP_GUIDE.md
echo.
pause
