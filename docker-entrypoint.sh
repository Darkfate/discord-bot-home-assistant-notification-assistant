#!/bin/sh
set -e

# Fix permissions on the data directory if it exists
if [ -d "/app/data" ]; then
    echo "Fixing permissions on /app/data..."
    chown -R nodejs:nodejs /app/data || true
    chmod -R 755 /app/data || true
fi

# Switch to nodejs user and run the command
exec su-exec nodejs "$@"
