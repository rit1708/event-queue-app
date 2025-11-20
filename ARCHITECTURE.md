# System Architecture

This document describes the end-to-end architecture of the Queue Management Platform, including its runtime components, data flow, deployment topology, and key design decisions.

## 1. High-Level Overview

The platform is built as a modular monorepo containing:

| Layer        | Location              | Purpose |
|--------------|----------------------|---------|
| API Service  | `services/api`        | Core REST API, queue orchestration, admin endpoints, SDK CDN |
| SDK Package  | `packages/sdk`        | TypeScript client library with retries, polling, validation |
| Client App   | `apps/client`         | End-user facing app for browsing events and joining queues |
| Admin App    | `apps/admin`          | Operational dashboard for managing events, queues, analytics |
| Infrastructure | `docker-compose.yml`, `run-project.sh` | Local and containerized deployments |

```
┌──────────────┐       ┌─────────────┐       ┌──────────────┐
│  Client App  │──────▶│              │◀──────│  Admin App   │
│ (React/Vite) │ queue │ queue-sdk    │ queue │ (React/Vite) │
└──────┬───────┘ calls │ (shared pkg) │ calls └──────┬──────┘
       │               └──────┬───────┘               │
       │ REST                │                        │
       ▼                     ▼                        ▼
┌────────────────────────────────────────────────────────┐
│                API Service (Node/Express)              │
│  - Routes: /events, /queue, /admin                     │
│  - Scheduler: Redis-based queue advancement            │
│  - Middleware: rate limiting, validation, logging      │
└──────────────┬────────────────────────────────────────┘
               │
        ┌──────▼────────┐        ┌──────────────┐
        │   MongoDB     │        │    Redis      │
        │ Events, domains│◀──────▶│ Queue states  │
        │ Entry history │        │ Active/waiting│
        └───────────────┘        └──────────────┘
```

## 2. Backend (services/api)

### Structure
- `routes/`: API surface mounted under `/api` (`/events`, `/queue`, `/admin`).
- `controllers/`: Business logic per domain (events, queue, admin).
- `middleware/`: Validation (Zod), async handler, error handler, rate limiter, logger.
- `db/`: MongoDB + Redis connection helpers with pooling/retry.
- `services/`: Scheduler that advances queues periodically.
- `schemas/`: Zod schemas for request validation.
- `utils/`: Logger, custom errors.

### Data flow
1. Request hits `/api/...` route.
2. `requestLogger` logs metadata.
3. Zod validation ensures payload shape.
4. Controller performs Mongo/Redis operations.
5. Response serialized; errors handled centrally via `errorHandler`.

### Queue mechanics
- Each event has Redis keys: `waiting`, `active`, `timer`, `userset`.
- `scheduler.service` runs every second to advance queues (respecting limits & intervals).
- MongoDB stores persistent metadata (events, domains, entry history).
- Admin APIs allow manual control (start/stop, advance, enqueue batch).

## 3. SDK (packages/sdk)

### Key modules
- `config.ts`: Initialization, env auto-detection, timeouts, retries, logging.
- `http.ts`: HTTP client with fetch wrapper, retries (exponential backoff), timeouts, abort support.
- `events.ts`, `queue.ts`, `admin.ts`: Domain-specific API helpers with validation.
- `types.ts`: Shared interfaces + custom error classes (`SDKError`, `NetworkError`, `TimeoutError`, `ValidationError`).
- `index.ts`: Barrel export + namespaced bundles (`events`, `queue`, `admin`).

### Features
- Auto-detects `baseUrl` via `window.__QUEUE_API_URL__`, `import.meta.env`, `process.env`, fallback `/api`.
- Supports manual `init({ baseUrl, timeout, retries, headers, enableLogging })`.
- Built-in polling helper with cleanup and error callbacks.
- CDN-ready: API server exposes `/api/sdk` endpoint serving built JS bundle.

## 4. Frontend Apps

### Shared patterns
- React + Vite + TypeScript.
- MUI components with custom theming.
- Feature-based folder structure (`components`, `hooks`, `pages`, `utils`, `types`, `styles`).
- Custom hooks for data fetching (`useEvents`, `useQueue`, `useQueueData`) encapsulate SDK usage, loading, error state, retries.
- Common UI elements (Snackbars, loaders, error panels) ensure consistent UX.

### Client App (`apps/client`)
- `HomePage`: Displays events, filter tabs, hero section.
- `QueuePage`: Allows joining queue, manages polling via SDK.
- Hooks manage queue state, handle errors gracefully, and expose `refetch` controls.

### Admin App (`apps/admin`)
- Sidebar layout with views (dashboard, events, users, analytics, settings).
- Dialogs for creating/updating/deleting events.
- Real-time queue insights (active/waiting counts, history charts).
- Uses SDK admin methods for all CRUD + queue operations.

## 5. Data Model

### MongoDB
- `domains`: `{ name, createdAt }`.
- `events`: `{ domain, name, queueLimit, intervalSec, isActive, timestamps }`.
- `entries`: `{ eventId, userId, enteredAt }` for analytics/history.

### Redis
- `q:<eventId>:waiting` (list) – FIFO queue of waiting user IDs.
- `q:<eventId>:active` (list) – current active batch.
- `q:<eventId>:timer` (key with TTL) – controls active window duration.
- `q:<eventId>:users` (set) – deduplication for enqueued users.

## 6. Deployment & Ops

### Local & Docker
- `run-project.sh` orchestrates local dev (API + clients) with optional Redis auto-start.
- `docker-compose.yml` provisions Mongo, Redis, API, Client, Admin containers with health checks and dependency ordering.
- Health endpoints (`/api/health`, `/`) support container orchestration.

### Logging & Monitoring
- API: JSON logs via custom logger (`info`, `warn`, `error`, `debug`).
- SDK: Optional request logging when `enableLogging` is true.
- Clients: Development-only console logging via custom logger utility.

## 7. Rate Limiting & Security
- Express middleware-based rate limiting: general API, queue operations, admin endpoints.
- CORS configurable per environment (`CORS_ORIGIN`).
- SDK validates inputs before hitting API, reducing malformed requests.
- Centralized error handling to avoid leaking stack traces.

## 8. Build & Release Flow
1. Install dependencies at repo root (`npm install`).
2. Build SDK (`npm --workspace queue-sdk run build`).
3. Build API (`npm --workspace queue-api run build`).
4. Build clients (`npm --workspace queue-client run build`, same for admin).
5. Docker deployment uses multi-stage builds for API; clients fronted by Vite dev servers or static hosting.

## 9. Future Enhancements
- Authentication/authorization for admin endpoints.
- WebSocket push for instantaneous queue updates.
- Automated test suites (unit + integration + e2e).
- Observability stack (Prometheus, Grafana, OpenTelemetry).
- Horizontal scaling via container orchestration (Kubernetes) and managed Redis/Mongo services.

---
This architecture file should serve as the authoritative reference for engineers, DevOps, and stakeholders to understand system boundaries, responsibilities, and deployment considerations. For in-depth implementation details, refer to component-specific directories and documentation (e.g., `FRONTEND_RESTRUCTURE.md`, `SDK_OPTIMIZATION.md`).
