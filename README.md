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
- 🌍 i18n (EN + UA)
- 🌗 Light / dark / high-contrast themes
- ♿ WCAG 2.1 AA accessibility

---

## 🛠️ Tech Stack

### Frontend
- **Angular 19** (standalone, signals, control flow)
- **TypeScript** strict mode
- **Angular Material** + CDK + Animations (custom theme)
- **NgRx Signal Store** + Component Store
- **Socket.io-client** for real-time
- **Sentry** for error tracking + session replay
- **PWA** (Service Worker, offline support)
- **@angular/localize** (EN + UA)
- **Vitest** + **Playwright**

### Backend
- **NestJS 10** (modules, DI, Guards, Pipes, Interceptors)
- **TypeScript** strict mode
- **Prisma** + **PostgreSQL** (Neon)
- **Redis** (Upstash) — cache + BullMQ queues
- **BullMQ** — background jobs (SLA checker, notifications, audit, email)
- **Socket.io** — WebSocket gateway
- **CQRS** pattern for tickets module
- **JWT** (access + refresh, httpOnly cookie)
- **argon2** password hashing
- **class-validator** + **class-transformer**
- **Swagger** API docs
- **Pino** structured logging
- **OpenTelemetry** (Honeycomb)
- **Sentry** error tracking

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
├── frontend/                Angular 19 app
├── backend/                 NestJS app
├── docs/
│   ├── adr/                 Architecture Decision Records
│   ├── ARCHITECTURE.md      C4 diagrams + data flow
│   ├── API.md               API documentation
│   └── walkthrough.md       Demo walkthrough
├── .github/workflows/       CI/CD pipelines
├── docker-compose.yml       Local dev environment
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

- [Architecture (C4 + data flow)](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [Architecture Decision Records](./docs/adr/)
- [Demo Walkthrough](./docs/walkthrough.md)
- [Contributing Guide](./CONTRIBUTING.md)

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
