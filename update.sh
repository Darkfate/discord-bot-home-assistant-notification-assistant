#!/bin/bash
set -e

echo "========================================"
echo "Discord Bot Docker Update Script"
echo "========================================"
echo ""

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed or not in PATH"
    exit 1
fi

# Function to check if docker compose v2 or legacy docker-compose is available
check_docker_compose() {
    if docker compose version &> /dev/null; then
        echo "docker compose"
    elif docker-compose --version &> /dev/null; then
        echo "docker-compose"
    else
        echo "Error: Docker Compose is not installed"
        exit 1
    fi
}

DOCKER_COMPOSE=$(check_docker_compose)

echo "Step 1: Pulling latest code from git..."
if [ -d ".git" ]; then
    git pull || echo "Warning: Could not pull latest changes. Continuing with local version..."
    echo "✓ Git pull complete"
else
    echo "⚠ Not a git repository, skipping git pull"
fi
echo ""

echo "Step 2: Stopping current container..."
$DOCKER_COMPOSE down
echo "✓ Container stopped"
echo ""

echo "Step 3: Pulling latest base images..."
$DOCKER_COMPOSE pull || echo "Warning: Could not pull base images. Continuing..."
echo ""

echo "Step 4: Building new image..."
$DOCKER_COMPOSE build --no-cache
echo "✓ Image built successfully"
echo ""

echo "Step 5: Starting updated container..."
$DOCKER_COMPOSE up -d
echo "✓ Container started"
echo ""

echo "Step 6: Waiting for container to initialize..."
sleep 3
echo ""

echo "Step 7: Showing container status and logs..."
echo "----------------------------------------"
$DOCKER_COMPOSE ps
echo ""
echo "Recent logs:"
echo "----------------------------------------"
$DOCKER_COMPOSE logs --tail=20
echo ""

echo "========================================"
echo "✓ Update complete!"
echo "========================================"
echo ""
echo "Container is now running with the latest version."
echo ""
echo "Useful commands:"
echo "  View logs:        $DOCKER_COMPOSE logs -f"
echo "  Stop container:   $DOCKER_COMPOSE down"
echo "  Restart:          $DOCKER_COMPOSE restart"
echo "  Status:           $DOCKER_COMPOSE ps"
echo ""
