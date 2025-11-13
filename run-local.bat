@echo off
setlocal enabledelayedexpansion

echo ======================================
echo Discord Bot - Local Development Setup
echo ======================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js is not installed
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

:: Check Node version
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
set NODE_VERSION=%NODE_VERSION:v=%
for /f "tokens=1 delims=." %%a in ("%NODE_VERSION%") do set NODE_MAJOR=%%a

if %NODE_MAJOR% LSS 18 (
    echo Error: Node.js version 18 or higher is required
    echo Current version: v%NODE_VERSION%
    echo Please upgrade Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [32m✓[0m Node.js v%NODE_VERSION% detected

:: Check if .env file exists
if not exist ".env" (
    echo.
    echo Warning: .env file not found
    echo Creating .env from .env.example...
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [32m✓[0m .env file created
        echo.
        echo [33mIMPORTANT:[0m You must edit .env and add your:
        echo    - DISCORD_TOKEN (from Discord Developer Portal^)
        echo    - DISCORD_CHANNEL_ID (right-click channel in Discord, Copy ID^)
        echo.
        echo After editing .env, run this script again.
        pause
        exit /b 0
    ) else (
        echo Error: .env.example not found
        pause
        exit /b 1
    )
) else (
    echo [32m✓[0m .env file found
)

:: Check if required env vars are set
findstr /C:"DISCORD_TOKEN=your_discord_bot_token_here" .env >nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Error: DISCORD_TOKEN not set in .env
    echo Please edit .env and add your Discord bot token
    pause
    exit /b 1
)

findstr /C:"DISCORD_CHANNEL_ID=your_discord_channel_id_here" .env >nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Error: DISCORD_CHANNEL_ID not set in .env
    echo Please edit .env and add your Discord channel ID
    pause
    exit /b 1
)

:: Additional check for empty values
for /f "tokens=2 delims==" %%a in ('findstr /B "DISCORD_TOKEN=" .env') do set DISCORD_TOKEN=%%a
for /f "tokens=2 delims==" %%a in ('findstr /B "DISCORD_CHANNEL_ID=" .env') do set DISCORD_CHANNEL_ID=%%a

if "%DISCORD_TOKEN%"=="" (
    echo.
    echo Error: DISCORD_TOKEN is empty in .env
    echo Please edit .env and add your Discord bot token
    pause
    exit /b 1
)

if "%DISCORD_CHANNEL_ID%"=="" (
    echo.
    echo Error: DISCORD_CHANNEL_ID is empty in .env
    echo Please edit .env and add your Discord channel ID
    pause
    exit /b 1
)

echo [32m✓[0m Environment variables configured

:: Create data directory if it doesn't exist
if not exist "data" (
    echo.
    echo Creating data directory...
    mkdir data
    echo [32m✓[0m Data directory created
) else (
    echo [32m✓[0m Data directory exists
)

:: Check if node_modules exists
if not exist "node_modules" (
    echo.
    echo [36mInstalling dependencies...[0m
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
    echo [32m✓[0m Dependencies installed
) else (
    echo [32m✓[0m Dependencies already installed
)

:: Start the bot
echo.
echo ======================================
echo [32mStarting Discord Bot...[0m
echo ======================================
echo.
echo Press Ctrl+C to stop the bot
echo.

npm run dev
