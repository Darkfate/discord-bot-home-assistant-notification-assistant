#!/bin/bash
set -e

echo "Setting up Discord Bot environment..."

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    echo "Creating data directory..."
    mkdir -p data
    echo "✓ Data directory created"
else
    echo "✓ Data directory already exists"
fi

# Create config directory if it doesn't exist
if [ ! -d "config" ]; then
    echo "Creating config directory..."
    mkdir -p config
    echo "✓ Config directory created"
else
    echo "✓ Config directory already exists"
fi

# Copy HA permissions example if it doesn't exist
if [ ! -f "config/ha-permissions.json" ]; then
    if [ -f "config/ha-permissions.json.example" ]; then
        echo "Copying HA permissions example file..."
        cp config/ha-permissions.json.example config/ha-permissions.json
        echo "✓ Created config/ha-permissions.json (edit this file to add authorized users)"
    fi
else
    echo "✓ config/ha-permissions.json already exists"
fi

echo ""
echo "Note: The Docker container will automatically fix permissions on startup."
echo ""
echo "Setup complete! You can now run:"
echo "  docker compose up --build -d"
echo ""
echo "Use --build to rebuild the image with the latest changes."
echo ""
