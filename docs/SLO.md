# Service Level Objectives

## Why this document exists

SLOs make reliability a deliberate engineering decision instead of a
vague aspiration. They give us a shared, numerical answer to:

- "Is the service healthy enough right now?"
- "Can we ship a risky change this week?"
- "Should we stop feature work and pay down reliability debt?"

This is a portfolio project, so the numbers are aspirational targets,
not contractual obligations — but the framework is the one a real
on-call team would use.

## Key concepts

- **SLI (Service Level Indicator)**: a measurable thing about the
  service. Example: "fraction of `/api/tickets` requests that return a
  2xx or 3xx within 500ms".
- **SLO (Service Level Objective)**: a target value for an SLI over a
  time window. Example: "99.5% over a rolling 30 days".
- **Error budget**: `100% - SLO`. The amount of unreliability we are
  *allowed* to spend before we have to stop and fix things. For a 99.5%
  SLO over 30 days, the budget is 3h 36m of downtime / failures.
- **Burn rate**: how fast we are consuming the budget. Burning 10x
  faster than sustainable means we exhaust 30 days of budget in 3 days.

## SLOs

### 1. API availability

| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| SLI           | `(2xx + 3xx + 4xx) / total` of requests to `/api/*`                    |
| SLO           | **99.5%** over a rolling 30-day window                                 |
| Error budget  | 0.5% = ~3h 36m of failed requests per 30 days                          |
| Why not 4xx out | 4xx is the client's fault, not ours. Excluding 4xx avoids penalising the service for misbehaving clients. |
| Why not 99.9% | We are a single-region deploy on free-tier infrastructure. 99.9% requires multi-region failover and a paid database tier. |

### 2. API latency

| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| SLI           | p95 latency of successful requests to `/api/*` (excludes file upload)  |
| SLO           | **p95 ≤ 500 ms** over a rolling 7-day window                           |
| Error budget  | 5% of requests above 500ms                                             |
| Why p95 not p99 | p99 on a low-traffic system is dominated by cold starts and one-off slow queries; not actionable. p95 catches systemic regressions. |

### 3. Realtime delivery

| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| SLI           | Time between `ticket.updated` event emission on the backend and receipt by a connected client |
| SLO           | **p95 ≤ 2 seconds** over a rolling 7-day window                        |
| Error budget  | 5% of events above 2s                                                  |

### 4. SLA processor freshness

| Field         | Value                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| SLI           | Lag between SLA breach time and the moment the breach event is emitted |
| SLO           | **p95 ≤ 90 seconds** (the BullMQ recurring job runs every 60s)         |
| Error budget  | 5% of breaches detected later than 90s                                 |

## How we measure

- **Latency and status codes**: the `MetricsInterceptor` records every
  request to a Prometheus-compatible histogram tagged with route and
  status. In production this is scraped by Render's built-in metrics
  endpoint; locally it is exposed at `/metrics`.
- **Realtime lag**: each emitted event includes a `serverTimestamp`.
  The frontend logs the delta on receipt; in a real production system
  we would ship that to a metrics backend.
- **SLA processor lag**: the processor logs `(now - breachAt)` on every
  breach detection.

For this portfolio project the metrics live in logs and `/metrics`. A
production deployment would ship them to Grafana / Datadog with
alerting on burn rate (see below).

## Error budget policy

The team uses the budget to **decide whether to ship**. The rules:

| Budget remaining | What we do                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| > 50%            | Ship anything. Take risks. Run experiments.                                    |
| 25–50%           | Ship normal feature work. No risky migrations on Friday.                       |
| 10–25%           | Feature work continues but every PR needs a reliability reviewer. Risky changes deferred. |
| 0–10%            | **Feature freeze.** Only reliability fixes, security patches, and rollbacks land. |
| Exhausted        | Postmortem required. Reliability work is the **only** work until the next window resets. |

The point is not to punish — it is to make the trade-off between
velocity and stability **visible and shared** instead of a private
opinion of whoever is loudest in standup.

## Burn-rate alerts

Two-window, two-burn-rate alerts (the SRE Workbook recipe):

| Severity | Condition                                                          | Page who?           |
| -------- | ------------------------------------------------------------------ | ------------------- |
| Critical | Burn rate > 14.4× over both 5min **and** 1h windows                | On-call immediately |
| Warning  | Burn rate > 6× over both 30min **and** 6h windows                  | On-call within hours |

A 14.4× burn rate exhausts a 30-day budget in ~2 days. A 6× burn rate
exhausts it in ~5 days. The two-window confirmation prevents flapping
on transient blips.

## What this looks like in practice

- We don't promise "100% uptime" — we promise we'll know within minutes
  when we drop below the line.
- A noisy alert that doesn't correspond to user pain is a bug in the
  SLI, not in the alert. Fix the SLI.
- The error budget is the team's, not management's. Engineers decide
  how to spend it. Management sets the SLO via business priorities.
- If we consistently overshoot the SLO (e.g. 99.95% when we promised
  99.5%), we are **over-investing in reliability** and should redirect
  effort. The budget is a target, not a floor.

## What is *not* in scope yet

This document defines the policy. The portfolio deployment does not yet
have:

- A real metrics backend (Grafana / Datadog) — metrics are scraped from
  `/metrics` only, no historical retention.
- Automated burn-rate alerting — no PagerDuty integration.
- A status page for users.

These are the next steps after deploy and are tracked in
`portfolio-resume/projects/service-desk-pro/interview-prep/SENIOR_GAPS.md`
under gap #6 (observability).

## References

- [Google SRE Book — Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
- [Google SRE Workbook — Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
