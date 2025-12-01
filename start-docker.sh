#!/bin/bash

# Ink and Arch Time Tracking System - Docker Node.js Starter
# Uses Node.js 22-alpine container exclusively

echo ""
echo "========================================================"
echo "   🐳 Ink and Arch - Docker Node.js Starter"
echo "========================================================"
echo ""

# Check if Docker is available
echo "🔍 Checking Docker availability..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found!"
    echo ""
    echo "📥 Please install Docker:"
    echo "   - Ubuntu/Debian: sudo apt-get install docker.io"
    echo "   - CentOS/RHEL: sudo yum install docker"
    echo "   - macOS: Install Docker Desktop from docker.com"
    echo "   - Or visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Docker found!"
echo ""

# Check if Docker daemon is running
echo "🔧 Checking Docker daemon..."
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker daemon not running!"
    echo "💡 Try: sudo systemctl start docker"
    echo "   Or start Docker Desktop on macOS"
    exit 1
fi

echo "✅ Docker daemon is running"
echo ""

# Pull Node.js Docker image
echo "📦 Pulling Node.js Docker image (node:22-alpine)..."
if ! docker pull node:22-alpine; then
    echo "❌ Failed to pull Docker image"
    echo "💡 Check your internet connection and Docker settings"
    exit 1
fi

echo "✅ Node.js Docker image ready"
echo ""

# Verify Node.js and npm versions in container
echo "🔍 Verifying Node.js installation in container..."
echo "Node.js version:"
docker run --rm node:22-alpine node -v
echo "npm version:"
docker run --rm node:22-alpine npm -v
echo ""

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    echo "📁 Creating data directory..."
    mkdir -p data
    echo "✅ Data directory created"
fi

# Display startup information
echo "🚀 Starting Ink and Arch Time Tracking System..."
echo ""
echo "📋 Docker Configuration:"
echo "   - Image: node:22-alpine"
echo "   - Port: 3001 (mapped to host)"
echo "   - Volume: Current directory mounted to /app"
echo "   - Working Directory: /app"
echo ""

echo "🔄 Container will perform these steps:"
echo "   1. Install npm dependencies"
echo "   2. Start the application server"
echo "   3. If start fails, install express@latest"
echo "   4. Retry server start"
echo ""

# Start the application in Docker container
echo "▶️  Starting container..."
echo ""

docker run -it --rm \
    --name inkandarch-app \
    -p 3001:3001 \
    -v "$(pwd)":/app \
    -w /app \
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

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Container completed successfully"
else
    echo ""
    echo "❌ Container exited with errors"
    echo ""
    echo "🔧 Troubleshooting tips:"
    echo "   1. Check if port 3001 is available: sudo lsof -i :3001"
    echo "   2. Ensure package.json exists in current directory"
    echo "   3. Verify Docker has enough resources allocated"
    echo "   4. Check Docker logs: docker logs <container-id>"
fi

echo ""
echo "🌐 If successful, open: http://localhost:3001"
echo ""
