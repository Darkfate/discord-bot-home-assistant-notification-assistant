#!/bin/bash
set -e

echo "Setting up Discord Bot environment..."

# Create data directory if it doesn't exist
if [ ! -d "data" ]; then
    echo "Creating data directory..."
    mkdir -p data
fi

# Set correct permissions for the nodejs user in Docker (uid 1001)
echo "Setting correct permissions for data directory..."
if [ "$(uname)" == "Darwin" ]; then
    # macOS
    sudo chown -R 1001:1001 data
elif [ -n "$(command -v sudo)" ]; then
    # Linux with sudo
    sudo chown -R 1001:1001 data
else
    # Try without sudo
    chown -R 1001:1001 data 2>/dev/null || echo "Warning: Could not change ownership. You may need to run: sudo chown -R 1001:1001 data"
fi

# Verify permissions
echo "Verifying permissions..."
ls -la data

echo ""
echo "Setup complete! You can now run:"
echo "  docker compose up -d"
echo ""
