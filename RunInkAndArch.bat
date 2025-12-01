@echo off
REM Go to project folder
cd /d "%~dp0"

REM Start the server in the background
start "" cmd /c "npm start"

REM Wait a few seconds for the server to start
timeout /t 5 /nobreak >nul

REM Open the frontend automatically
start "" "http://localhost:3001"
