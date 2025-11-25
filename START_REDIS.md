# How to Start Redis to Fix 503 Error

The 503 Service Unavailable error occurs because **Redis is not running**. Redis is required for queue operations.

## Quick Fix Options

### Option 1: Install and Start Redis (Recommended)

```bash
# Install Redis
sudo apt update
sudo apt install -y redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server  # Optional: start on boot

# Verify it's running
redis-cli ping
# Should return: PONG
```

### Option 2: Start Redis with Docker

If you have Docker installed:

```bash
# Start Docker daemon first (if not running)
sudo systemctl start docker

# Then start Redis container
cd /home/tw-hp/Documents/my-new-queue-app
docker compose up -d redis

# Verify
docker ps | grep redis
```

### Option 3: Run Redis Manually (Temporary)

If Redis is installed but not as a service:

```bash
# Find Redis binary
which redis-server

# Start Redis in background
redis-server --daemonize yes --port 6379

# Verify
redis-cli ping
```

## Verify Redis is Running

After starting Redis, check:

```bash
# Check if port 6379 is listening
netstat -tuln | grep 6379
# or
ss -tuln | grep 6379

# Test connection
redis-cli ping
# Should return: PONG

# Check API health
curl http://localhost:4000/api/health
# Should show: "redis": true
```

## Test the Endpoint Again

Once Redis is running, test the start endpoint:

```bash
curl -X POST http://localhost:5174/api/admin/event/start \
  -H "Content-Type: application/json" \
  -d '{"eventId":"691db29d360f8b835418a182"}'
```

Should return:
```json
{
  "success": true
}
```

## Troubleshooting

### If Redis won't start:
1. Check if port 6379 is already in use: `sudo lsof -i :6379`
2. Check Redis logs: `sudo journalctl -u redis-server -n 50`
3. Try starting with verbose output: `redis-server --verbose`

### If Docker won't start:
1. Check Docker status: `sudo systemctl status docker`
2. Start Docker: `sudo systemctl start docker`
3. Add user to docker group (to avoid sudo): `sudo usermod -aG docker $USER` (then logout/login)

