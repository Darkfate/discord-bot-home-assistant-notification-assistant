#!/bin/bash
set -e

echo "======================================"
echo "Discord Bot - Local Development Setup"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version 18 or higher is required"
    echo "Current version: $(node -v)"
    echo "Please upgrade Node.js from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js $(node -v) detected"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  Warning: .env file not found"
    echo "Creating .env from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ .env file created"
        echo ""
        echo "📝 IMPORTANT: You must edit .env and add your:"
        echo "   - DISCORD_TOKEN (from Discord Developer Portal)"
        echo "   - DISCORD_CHANNEL_ID (right-click channel in Discord, Copy ID)"
        echo ""
        echo "After editing .env, run this script again."
        exit 0
    else
        echo "❌ Error: .env.example not found"
        exit 1
    fi
else
    echo "✓ .env file found"
fi

# Check if required env vars are set
source .env
if [ -z "$DISCORD_TOKEN" ] || [ "$DISCORD_TOKEN" = "your_discord_bot_token_here" ]; then
    echo ""
    echo "❌ Error: DISCORD_TOKEN not set in .env"
    echo "Please edit .env and add your Discord bot token"
    exit 1
fi

if [ -z "$DISCORD_CHANNEL_ID" ] || [ "$DISCORD_CHANNEL_ID" = "your_discord_channel_id_here" ]; then
    echo ""
    echo "❌ Error: DISCORD_CHANNEL_ID not set in .env"
    echo "Please edit .env and add your Discord channel ID"
    exit 1
fi

echo "✓ Environment variables configured"

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    echo ""
    echo "Creating data directory..."
    mkdir -p data
    echo "✓ Data directory created"
else
    echo "✓ Data directory exists"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    echo "✓ Dependencies installed"
else
    echo "✓ Dependencies already installed"
fi

# Start the bot
echo ""
echo "======================================"
echo "🚀 Starting Discord Bot..."
echo "======================================"
echo ""
echo "Press Ctrl+C to stop the bot"
echo ""

npm run dev
