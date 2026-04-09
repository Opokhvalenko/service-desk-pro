# API Versioning

## Status

Current version: **v1**. All endpoints are served under the `/api` prefix
with no explicit version segment yet, because we have a single client
(the SPA in `frontend/`) that ships in lockstep with the backend.

This document defines the policy we will apply **the moment a second
consumer appears** (mobile app, partner integration, public API).

## Why we don't version yet

Versioning has a real cost: duplicated controllers, duplicated DTOs,
deprecation tracking, docs that drift between versions. Paying that cost
before there is a second consumer is premature complexity. The single
SPA client is updated atomically with the backend, so a breaking change
is just "ship them together".

## When to introduce v2

Introduce explicit versioning the first time **any** of these is true:

1. A second consumer exists that we do not control the release cadence of
   (mobile app on the App Store, partner SDK, public REST API).
2. We need to make a breaking change but cannot retire the old shape
   immediately because some clients are still on it.
3. A regulatory or contractual obligation requires a stable API surface
   for N months.

Until then, prefer **additive evolution** over versioning (see below).

## Versioning scheme

When the trigger fires, switch to URI versioning via Nest's built-in
support:

```ts
// main.ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```

Endpoints become `/api/v1/tickets`, `/api/v2/tickets`, etc. Controllers
opt in:

```ts
@Controller({ path: 'tickets', version: '2' })
export class TicketsV2Controller { /* ... */ }
```

We chose URI versioning over header versioning because:

- It's visible in logs and dashboards without parsing headers.
- It's trivial for curl, Postman, browser devtools.
- Caching layers (CDN, nginx) handle distinct paths natively.

Header versioning is more "RESTful" but the operational ergonomics lose.

## Additive evolution (preferred)

Most changes don't need a new version. Use these patterns first:

| Change                    | How to do it without versioning                                                  |
| ------------------------- | -------------------------------------------------------------------------------- |
| Add a new field           | Add it. Old clients ignore unknown fields.                                       |
| Add a new endpoint        | Add it. Old clients don't call it.                                               |
| Add a new optional param  | Add it with a safe default. Old clients omit it.                                 |
| Rename a field            | Add the new field, keep the old one, deprecate the old one in OpenAPI, drop later. |
| Change validation rules to be **more permissive** | Just do it.                                              |

## Genuinely breaking changes

These need a new version (or a coordinated all-clients release if there
is still only one client):

- Removing a field that clients read.
- Changing the type of a field (string → number, scalar → object).
- Changing the meaning of an enum value.
- Tightening validation in a way that rejects previously valid input.
- Changing the URL structure of a resource.
- Changing authentication / authorisation requirements on an endpoint.

## Deprecation policy

Once we have v2:

1. Mark the old endpoint with `@ApiOperation({ deprecated: true })` so it
   shows struck-through in Swagger.
2. Add a `Deprecation` and `Sunset` HTTP response header (RFC 8594) with
   the planned removal date.
3. Log a warning every time the deprecated endpoint is hit, with the
   user agent. Track the count in metrics.
4. Communicate the sunset date in the changelog and to known integrators.
5. Remove the old endpoint **only after** the metric shows zero traffic
   for at least one full release cycle.

Minimum deprecation window: **90 days** for internal consumers,
**180 days** for external consumers.

## What this means for the current codebase

- Keep using `/api/tickets` (no version segment) until the trigger fires.
- When adding fields, add them — don't worry about it.
- When you would otherwise make a breaking change, **stop** and ask
  whether the change can be expressed additively. Almost always it can.
- If a breaking change is truly necessary today, coordinate the BE+FE
  release in the same PR or paired PRs and merge them together.

## References

- [Nest versioning docs](https://docs.nestjs.com/techniques/versioning)
- [RFC 8594 — Sunset HTTP Header](https://datatracker.ietf.org/doc/html/rfc8594)
- [Stripe API versioning](https://stripe.com/docs/api/versioning) — gold standard
