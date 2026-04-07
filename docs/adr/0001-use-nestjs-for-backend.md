# ADR 0001: Use NestJS for the Backend

**Status:** Accepted
**Date:** 2026-04-07
**Deciders:** Oksana Pokhvalenko

---

## Context

ServiceDesk Pro is a B2B ticketing platform with enterprise characteristics:
- 4 user roles with fine-grained RBAC
- Complex state machine for ticket workflow
- SLA engine with background jobs
- Real-time updates via WebSockets
- CQRS-friendly domain (commands vs queries)
- Audit log for every important action
- Multiple background processes (SLA checker, notifications, email)

We need a backend framework that supports modular architecture, dependency injection, and provides first-class integrations for the patterns we plan to use.

## Decision

We will use **NestJS 10** as the backend framework, with TypeScript in strict mode.

## Alternatives Considered

### Express + TypeScript
- ✅ Lightweight, full control
- ✅ Massive ecosystem
- ❌ Everything has to be wired manually (DI, validation, error handling)
- ❌ Lacks built-in module structure → easy to drift into "big ball of mud"
- ❌ Reads as a junior-level choice for an enterprise system

### Fastify + TypeScript
- ✅ High performance
- ✅ Good plugin system
- ❌ Smaller ecosystem than NestJS
- ❌ No first-class CQRS / DI / Guards out of the box
- ❌ Less common in enterprise hiring signals

### NestJS
- ✅ First-class TypeScript support
- ✅ Built-in DI container
- ✅ Modules, Guards, Pipes, Interceptors, Filters
- ✅ Official `@nestjs/cqrs` for CQRS pattern
- ✅ Official integrations: Swagger, Prisma, BullMQ, Socket.io, Terminus, Throttler, Sentry
- ✅ Strong community and enterprise adoption
- ✅ Reads as a senior/mid-level choice

## Consequences

### Positive
- Clear module boundaries from day one
- Decorators (`@Controller`, `@Injectable`, `@UseGuards`) make intent obvious
- Out-of-the-box support for everything we need (validation, OpenAPI, jobs, websockets, health checks)
- Easy to test (built-in `@nestjs/testing` module)
- Strong portfolio signal — NestJS is the de facto standard for enterprise Node.js

### Negative
- Slightly steeper learning curve than Express
- More boilerplate per endpoint (controller + service + DTO + module wiring)
- Heavier framework footprint

### Mitigations
- Follow NestJS official style guide and folder layout
- Use `nest generate` CLI to reduce boilerplate
- Document conventions in `CONTRIBUTING.md`

---

## Related ADRs

- ADR 0002 — CQRS pattern for tickets module (planned)
- ADR 0003 — Render hosting over Fly.io (planned)
- ADR 0004 — Cloudinary for file storage (planned)
