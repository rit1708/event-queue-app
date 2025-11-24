#!/bin/bash

# Script to start Redis for the queue application

echo "Starting Redis for Queue Application..."

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "Using Docker to start Redis..."
    cd "$(dirname "$0")"
    docker compose up redis -d
    if [ $? -eq 0 ]; then
        echo "✅ Redis started successfully with Docker"
        echo "Redis is running on port 6379"
        exit 0
    else
        echo "❌ Failed to start Redis with Docker"
    fi
fi

# Check if redis-server is available locally
if command -v redis-server &> /dev/null; then
    echo "Starting Redis server locally..."
    redis-server --daemonize yes --port 6379
    if [ $? -eq 0 ]; then
        echo "✅ Redis started successfully locally"
        echo "Redis is running on port 6379"
        exit 0
    else
        echo "❌ Failed to start Redis server"
    fi
fi

# If neither method worked
echo "❌ Could not start Redis"
echo ""
echo "Please install Redis using one of these methods:"
echo "1. Install Docker and run: docker compose up redis -d"
echo "2. Install Redis locally:"
echo "   - Ubuntu/Debian: sudo apt install redis-server"
echo "   - macOS: brew install redis"
echo "   - Then run: redis-server"
exit 1

