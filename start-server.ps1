# Ink and Arch - Portable Server Startup Script (PowerShell)
# This script works regardless of folder location or name

# Get the directory where this script is located
$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDirectory

Write-Host "Ink and Arch Server Startup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Gray
Write-Host ""

# Check if npm is installed
try {
    npm --version | Out-Null
} catch {
    Write-Host "ERROR: npm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Starting server..." -ForegroundColor Yellow

# Start the server in a new window
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm start" -NoNewWindow

# Wait for the server to start
Write-Host "Waiting for server to start (5 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Open the frontend in default browser
Write-Host "Opening dashboard in browser..." -ForegroundColor Cyan
Start-Process "http://localhost:3001"

Write-Host ""
Write-Host "✅ Server started successfully!" -ForegroundColor Green
Write-Host "✅ Dashboard opened at http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C in the server console to stop the server" -ForegroundColor Yellow
