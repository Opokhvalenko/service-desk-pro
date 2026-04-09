import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Counter, collectDefaultMetrics, Histogram, Registry } from 'prom-client';

/**
 * Central Prometheus registry. Wraps `prom-client` so the rest of the app
 * never imports it directly — easier to swap out (e.g. OTEL metrics export)
 * and keeps the metric vocabulary in one place.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'sdp_http_requests_total',
    help: 'Total number of HTTP requests handled by the API',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'sdp_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  readonly ticketTransitions = new Counter({
    name: 'sdp_ticket_transitions_total',
    help: 'Ticket status transitions, labelled by from/to status',
    labelNames: ['from', 'to'] as const,
    registers: [this.registry],
  });

  readonly slaBreaches = new Counter({
    name: 'sdp_sla_breaches_total',
    help: 'SLA breaches detected by the scheduler',
    labelNames: ['type'] as const,
    registers: [this.registry],
  });

  onModuleInit(): void {
    this.registry.setDefaultLabels({ app: 'service-desk-pro' });
    collectDefaultMetrics({ register: this.registry });
  }
}
