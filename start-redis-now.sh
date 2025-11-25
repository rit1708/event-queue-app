#!/bin/bash
echo "=========================================="
echo "Starting Redis for Queue Application"
echo "=========================================="
echo ""

# Check if Redis is already running
if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "✅ Redis is already running!"
    exit 0
fi

# Try Docker first
if command -v docker &> /dev/null && docker ps &>/dev/null; then
    echo "Attempting to start Redis with Docker..."
    cd "$(dirname "$0")"
    if docker compose up -d redis 2>/dev/null; then
        sleep 2
        if redis-cli ping 2>/dev/null | grep -q PONG; then
            echo "✅ Redis started successfully with Docker!"
            exit 0
        fi
    fi
fi

# Check if redis-server is installed
if command -v redis-server &> /dev/null; then
    echo "Starting Redis server locally..."
    redis-server --daemonize yes --port 6379 2>/dev/null
    sleep 1
    if redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "✅ Redis started successfully!"
        exit 0
    fi
fi

echo ""
echo "❌ Could not start Redis automatically"
echo ""
echo "Please install Redis using one of these methods:"
echo ""
echo "Option 1: Install Redis (Recommended)"
echo "  sudo apt update"
echo "  sudo apt install -y redis-server"
echo "  sudo systemctl start redis-server"
echo ""
echo "Option 2: Start Docker and use Docker Compose"
echo "  sudo systemctl start docker"
echo "  docker compose up -d redis"
echo ""
echo "After installing, verify with: redis-cli ping"
echo "Should return: PONG"
