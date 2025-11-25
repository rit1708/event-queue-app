# Queue Management Monorepo

Apps and packages for a multi-domain queue system.

- API: Node + Express + TypeScript
- Client: React + Vite + TypeScript
- Admin: React + Vite + TypeScript
- SDK: TypeScript client SDK

## Prerequisites

- Node.js and npm
- MongoDB (running on port 27017)
- **Redis** (running on port 6379) - **REQUIRED for queue operations**

## Quick start

### Option 1: Docker Compose (Recommended)

```bash
docker compose up --build
```

This starts all services including MongoDB and Redis.

### Option 2: Local Development

1. **Start MongoDB** (if not already running):
   ```bash
   # Using Docker
   docker compose up -d mongo
   
   # Or use local MongoDB installation
   ```

2. **Start Redis** (REQUIRED):
   ```bash
   # Quick start script
   ./start-redis-now.sh
   
   # Or manually:
   # Install: sudo apt install redis-server
   # Start: sudo systemctl start redis-server
   # Or with Docker: docker compose up -d redis
   ```

3. **Install dependencies and start services**:
   ```bash
   npm install
   npm run dev:local
   ```

## Service URLs

- API: http://localhost:4000
- Client: http://localhost:5173
- Admin: http://localhost:5174

## Troubleshooting

### 503 Service Unavailable Error

If you get a **503 error** when trying to start an event or join a queue, **Redis is not running**.

**Quick Fix:**
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# If not running, start it:
./start-redis-now.sh

# Or manually:
sudo apt install redis-server
sudo systemctl start redis-server
```

**Verify Redis is working:**
```bash
# Check API health
curl http://localhost:4000/api/health
# Should show: "redis": true
```

See [START_REDIS.md](./START_REDIS.md) for detailed Redis setup instructions.
