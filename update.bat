@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Discord Bot Docker Update Script
echo ========================================
echo.

REM Check if docker is available
docker --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not installed or not in PATH
    exit /b 1
)

REM Check if docker compose is available (v2 plugin style)
docker compose version >nul 2>&1
if errorlevel 1 (
    REM Try legacy docker-compose
    docker-compose --version >nul 2>&1
    if errorlevel 1 (
        echo Error: Docker Compose is not installed
        exit /b 1
    )
    set DOCKER_COMPOSE=docker-compose
) else (
    set DOCKER_COMPOSE=docker compose
)

echo Step 1: Pulling latest code from git...
if exist ".git" (
    git pull || echo Warning: Could not pull latest changes. Continuing with local version...
    echo [32m✓ Git pull complete[0m
) else (
    echo [33m⚠ Not a git repository, skipping git pull[0m
)
echo.

echo Step 2: Stopping current container...
%DOCKER_COMPOSE% down
echo [32m✓ Container stopped[0m
echo.

echo Step 3: Pulling latest base images...
%DOCKER_COMPOSE% pull || echo Warning: Could not pull base images. Continuing...
echo.

echo Step 4: Building new image...
%DOCKER_COMPOSE% build --no-cache
echo [32m✓ Image built successfully[0m
echo.

echo Step 5: Starting updated container...
%DOCKER_COMPOSE% up -d
echo [32m✓ Container started[0m
echo.

echo Step 6: Waiting for container to initialize...
timeout /t 3 /nobreak >nul
echo.

echo Step 7: Showing container status and logs...
echo ----------------------------------------
%DOCKER_COMPOSE% ps
echo.
echo Recent logs:
echo ----------------------------------------
%DOCKER_COMPOSE% logs --tail=20
echo.

echo ========================================
echo [32m✓ Update complete![0m
echo ========================================
echo.
echo Container is now running with the latest version.
echo.
echo Useful commands:
echo   View logs:        %DOCKER_COMPOSE% logs -f
echo   Stop container:   %DOCKER_COMPOSE% down
echo   Restart:          %DOCKER_COMPOSE% restart
echo   Status:           %DOCKER_COMPOSE% ps
echo.

endlocal
