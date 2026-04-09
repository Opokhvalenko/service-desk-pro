# ServiceDesk Pro

> B2B Support Ticket Platform with role-based workflow, SLA engine, and real-time updates.

[![CI](https://github.com/Opokhvalenko/service-desk-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/Opokhvalenko/service-desk-pro/actions)
[![codecov](https://codecov.io/gh/Opokhvalenko/service-desk-pro/branch/main/graph/badge.svg)](https://codecov.io/gh/Opokhvalenko/service-desk-pro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Overview

Enterprise-grade ticket management system for support teams. Requesters create tickets, agents process them under SLA constraints, team leads supervise queues, and admins manage the platform.

**Key features:**
- 🔐 4-role RBAC (Requester, Agent, Team Lead, Admin)
- 📋 State machine workflow with allowed transitions
- ⏱️ SLA engine with breach detection
- 💬 Comments + internal notes
- 📎 File attachments (Cloudinary)
- 📊 Dashboard analytics + reports
- 🔔 Real-time updates via WebSockets
- 📜 Centralized audit log
- 🌍 i18n (EN + UA, runtime switch)
- 🌗 Light / dark themes (Material 3, `prefers-color-scheme` aware, persisted)
- 📈 Prometheus metrics + OpenTelemetry tracing
- 🏥 Health checks (`/health/live`, `/health/ready`)

---

## 📸 Screenshots

### Authentication & Dashboard

| Login | Dashboard (Admin) |
|---|---|
| ![Login](./docs/screenshots/01-login.png) | ![Dashboard](./docs/screenshots/02-dashboard-admin.png) |

### Tickets

| Tickets list | Ticket detail (with SLA breach + Quick actions) |
|---|---|
| ![Tickets list](./docs/screenshots/03-tickets-list-admin.png) | ![Ticket detail](./docs/screenshots/04-ticket-detail-admin.png) |

| Queue (unassigned) | My tickets |
|---|---|
| ![Queue](./docs/screenshots/05-queue.png) | ![My tickets](./docs/screenshots/06-my-tickets.png) |

| New ticket dialog |
|---|
| ![New ticket](./docs/screenshots/19-new-ticket-dialog.png) |

### Reports & Notifications

| Reports (KPIs + 4 charts + agent workload) |
|---|
| ![Reports](./docs/screenshots/07-reports.png) |

| Notifications | Profile |
|---|---|
| ![Notifications](./docs/screenshots/13-notifications.png) | ![Profile](./docs/screenshots/14-profile.png) |

### Admin

| Users | Categories |
|---|---|
| ![Users](./docs/screenshots/08-admin-users.png) | ![Categories](./docs/screenshots/09-admin-categories.png) |

| Teams | SLA policies |
|---|---|
| ![Teams](./docs/screenshots/10-admin-teams.png) | ![SLA](./docs/screenshots/11-admin-sla.png) |

| Audit log |
|---|
| ![Audit log](./docs/screenshots/12-admin-audit-log.png) |

### Theme & i18n

| Dashboard — Dark mode (EN) | Dashboard — Dark mode (UA) |
|---|---|
| ![Dark EN](./docs/screenshots/15-dashboard-dark.png) | ![Dark UA](./docs/screenshots/16-dashboard-dark-uk.png) |

### RBAC — same app, different roles

| Requester (2 nav items) | Agent (4 nav items) |
|---|---|
| ![Requester](./docs/screenshots/17-requester-tickets.png) | ![Agent](./docs/screenshots/18-agent-tickets.png) |

> Notice how `Queue`, `My tickets`, `Reports` and `Admin` appear/disappear from the toolbar based on the signed-in role — driven by the `*hasPermission` directive backed by a single `PERMISSION_MATRIX` constant. See [ADR 0003 — RBAC strategy](./docs/adr/0003-rbac-strategy.md).

---

## 🛠️ Tech Stack

### Frontend
- **Angular 21** (standalone components, signals, control flow `@if/@for/@defer`)
- **TypeScript** strict mode
- **Angular Material 3** (`mat.theme()`, dark/light via `data-theme`)
- **Signals + service stores** (no NgRx — `inject()` + `signal()` / `computed()`)
- **Custom directives & pipes** — `*hasRole`, `*hasPermission`, `timeAgo`, `slaStatus`
- **Socket.io-client** for realtime ticket rooms
- **PWA** — Service Worker via `@angular/service-worker` (`ngsw-config.json`)
- **Custom i18n** — `I18nStore` + `TranslatePipe` (EN + UA, runtime locale switch)
- **Sentry** for error tracking
- **chart.js + ng2-charts** for dashboard / reports
- **Vitest** + **Playwright** (MCP-driven E2E)

### Backend
- **NestJS 11** (modules, DI, Guards, Pipes, Interceptors, Filters)
- **TypeScript** strict mode
- **Prisma 6** + **PostgreSQL** (Neon)
- **Redis** (ioredis) — Socket.io adapter + Throttler counters
- **In-process SLA scheduler** (`@Cron('*/60 * * * * *')`) — see [ADR 0005](./docs/adr/0005-sla-scheduler-in-process.md)
- **Socket.io** — WebSocket gateway with per-ticket rooms
- **JWT** (access 15m + refresh 7d httpOnly cookie) + **argon2** hashing
- **`@nestjs/throttler`** — global rate limit + 5/min on auth endpoints
- **Request-ID middleware** — `x-request-id` correlation across logs + error envelope
- **`@nestjs/terminus`** health checks (`/health/live`, `/health/ready` with DB + Redis ping)
- **Prometheus metrics** via `prom-client` at `/metrics` (HTTP counters + histograms + ticket transitions + SLA breaches)
- **OpenTelemetry** auto-instrumentation
- **Sentry** error tracking
- **Pino** structured logging (with `requestId` correlation)
- **`@nestjs/swagger`** API docs at `/api/docs`
- **class-validator** + **class-transformer**
- **Cloudinary** for attachments (magic-bytes validation server-side)

### Storage & Infrastructure
- **PostgreSQL** — Neon (Frankfurt)
- **Redis** — Upstash (Ireland)
- **Files** — Cloudinary
- **FE deploy** — Vercel
- **BE deploy** — Render + UptimeRobot keep-alive
- **Observability** — Sentry + Honeycomb
- **CI/CD** — GitHub Actions
- **Containers** — Docker (multi-stage)

---

## 📁 Repository Structure

```
service-desk-pro/
├── frontend/                Angular 21 app (standalone, signals, Material 3)
├── backend/                 NestJS 11 app (Prisma, JWT, Socket.io, SLA cron)
├── docs/
│   ├── adr/                 Architecture Decision Records (5)
│   ├── ARCHITECTURE.md      C4 diagrams + module layout + cross-cutting concerns
│   └── screenshots/         README screenshots
├── .github/workflows/       CI/CD pipelines
├── docker-compose.yml       Local dev environment (PG + Redis + Mailhog)
├── render.yaml              Render Blueprint for backend deploy
├── DEPLOY.md                Deployment runbook
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ (LTS)
- npm or pnpm
- Docker + Docker Compose (for local PG + Redis)

### Local Development

```bash
# Clone repo
git clone https://github.com/Opokhvalenko/service-desk-pro.git
cd service-desk-pro

# Start PG + Redis + Mailhog
docker-compose up -d

# Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm start
```

- Frontend: http://localhost:4200
- Backend: http://localhost:3000
- Swagger: http://localhost:3000/api/docs
- Mailhog: http://localhost:8025

> **Local vs Cloud:** `backend/.env.example` includes both Neon/Upstash (cloud) and docker-compose (local) connection strings. Uncomment the local block in `.env` to run fully offline against Docker.

---

## 🧪 Testing

```bash
# Backend
cd backend
npm run test           # unit
npm run test:e2e       # integration

# Frontend
cd frontend
npm run test           # vitest unit/component
npm run e2e            # playwright
```

---

## 📚 Documentation

- [Architecture (C4 Context + Container diagrams)](./docs/ARCHITECTURE.md)
- [Architecture Decision Records](./docs/adr/)
  - [ADR 0001 — NestJS for backend](./docs/adr/0001-use-nestjs-for-backend.md)
  - [ADR 0002 — Prisma over TypeORM](./docs/adr/0002-prisma-over-typeorm.md)
  - [ADR 0003 — RBAC strategy (roles + permission matrix)](./docs/adr/0003-rbac-strategy.md)
  - [ADR 0004 — Cloudinary for attachments](./docs/adr/0004-cloudinary-for-attachments.md)
  - [ADR 0005 — In-process SLA scheduler (no BullMQ)](./docs/adr/0005-sla-scheduler-in-process.md)
- API reference — interactive Swagger at `/api/docs` when the backend is running
- [Deployment guide](./DEPLOY.md)

---

## 🔐 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@servicedesk.com | password123 |
| Team Lead | lead@servicedesk.com | password123 |
| Agent | agent@servicedesk.com | password123 |
| Requester | user@servicedesk.com | password123 |

> Demo data resets daily at 03:00 UTC.

---

## 📄 License

MIT © Oksana Pokhvalenko
