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

echo ""
echo "Note: The Docker container will automatically fix permissions on startup."
echo ""
echo "Setup complete! You can now run:"
echo "  docker compose up --build -d"
echo ""
echo "Use --build to rebuild the image with the latest changes."
echo ""
