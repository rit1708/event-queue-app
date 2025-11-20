#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Default mode
MODE="${1:-local}"

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if Docker is running (for docker mode)
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Check if Node.js is installed (for local mode)
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
}

# Check if dependencies are installed
check_dependencies() {
    if [ ! -d "node_modules" ]; then
        print_info "Dependencies not found. Installing..."
        npm install
        print_success "Dependencies installed"
    fi
}

ensure_port_free() {
    local port="$1"
    if lsof -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1; then
        local pids
        pids=$(lsof -ti tcp:"$port")
        if [ -n "$pids" ]; then
            print_info "Freeing port $port (processes: $pids)"
            kill "$pids" > /dev/null 2>&1 || true
            sleep 1
        fi
    fi
}

# Start with Docker
start_docker() {
    print_header "Starting Project with Docker"
    check_docker
    
    print_info "Starting services with Docker Compose..."
    docker compose up --build
}

# Start Redis if available via Docker
start_redis_if_available() {
    if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
        # Check if Redis container exists
        if docker ps -a --format '{{.Names}}' | grep -q 'redis'; then
            REDIS_CONTAINER=$(docker ps -a --format '{{.Names}}' | grep 'redis' | head -1)
            if ! docker ps --format '{{.Names}}' | grep -q 'redis'; then
                print_info "Starting Redis container..."
                docker start "$REDIS_CONTAINER" > /dev/null 2>&1
                sleep 1
                print_success "Redis container started"
            else
                print_info "Redis container already running"
            fi
        fi
    fi
}

# Start locally
start_local() {
    print_header "Starting Project Locally"
    check_node
    check_dependencies
    ensure_port_free 4000
    
    # Try to start Redis if available
    start_redis_if_available
    
    export MONGO_URL="${MONGO_URL:-mongodb://127.0.0.1:27017/queue-app}"
    export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
    export VITE_API_URL="${VITE_API_URL:-http://localhost:4000/api}"
    print_info "Starting all services locally (API -> $VITE_API_URL)..."
    
    # Check if concurrently is installed
    if ! npm list concurrently &> /dev/null; then
        print_info "Installing concurrently..."
        npm install --save-dev concurrently
    fi
    
    npm run dev:local
}

# Show usage
show_usage() {
    echo "Usage: ./run-project.sh [docker|local|help]"
    echo ""
    echo "Options:"
    echo "  docker    Start all services using Docker Compose"
    echo "  local     Start all services locally (requires MongoDB & Redis)"
    echo "  help      Show this help message"
    echo ""
    echo "Default: local"
}

# Main execution
case "$MODE" in
    docker)
        start_docker
        ;;
    local)
        start_local
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown mode: $MODE"
        show_usage
        exit 1
        ;;
esac

