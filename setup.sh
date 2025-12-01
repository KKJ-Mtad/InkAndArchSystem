#!/bin/bash

# Ink and Arch Time Tracking System - Automated Setup Script
# This script sets up the application on a fresh machine

echo "🚀 Ink and Arch Time Tracking System Setup"
echo "==========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16.0.0 or higher"
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="16.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install version $REQUIRED_VERSION or higher"
    exit 1
fi

echo "✅ Node.js version $NODE_VERSION detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    echo "📁 Creating data directory..."
    mkdir -p data
    echo "✅ Data directory created"
fi

# Install dependencies
echo "📦 Installing dependencies..."
if npm install; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    echo "💡 Try running: npm cache clean --force && npm install"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️ Creating default .env configuration..."
    cat > .env << EOL
# Ink and Arch Time Tracking Configuration
PORT=3001
NODE_ENV=development

# MongoDB (Optional - leave empty to use SQLite only)
MONGODB_URI=
MONGODB_DB_NAME=inkandarch

# Security (Change these in production)
SESSION_SECRET=change-this-in-production
EOL
    echo "✅ Default .env file created"
fi

# Check if PM2 is available (for production)
if command -v pm2 &> /dev/null; then
    echo "✅ PM2 detected - production ready"
    HAS_PM2=true
else
    echo "💡 PM2 not installed. Install with: npm install -g pm2 (recommended for production)"
    HAS_PM2=false
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Start the application:"
if [ "$HAS_PM2" = true ]; then
    echo "   For development: npm start"
    echo "   For production:  pm2 start server.js --name inkandarch"
else
    echo "   npm start"
fi
echo ""
echo "2. Open your browser to: http://localhost:3001"
echo ""
echo "3. Login with default credentials:"
echo "   Admin:      username: admin,     password: admin"
echo "   Front Desk: username: frontdesk, password: frontdesk"
echo "   Employee:   username: employee,  password: employee"
echo ""
echo "⚠️  Important: Change default passwords in production!"
echo ""
echo "📚 For detailed documentation, see SETUP_GUIDE.md"
echo "🔧 For troubleshooting, see the setup guide or check server logs"
