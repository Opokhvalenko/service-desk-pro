import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Records HTTP request count + latency on every response. Uses the route
 * pattern (e.g. `/tickets/:id`) instead of the resolved URL to keep the
 * cardinality bounded.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { route?: { path?: string } }>();
    const res = http.getResponse<Response>();
    const method = req.method;
    const stop = this.metrics.httpDuration.startTimer();

    return next.handle().pipe(
      tap({
        next: () => this.record(method, req.route?.path ?? req.path, res.statusCode, stop),
        error: () => this.record(method, req.route?.path ?? req.path, res.statusCode || 500, stop),
      }),
    );
  }

  private record(
    method: string,
    route: string,
    status: number,
    stop: (labels?: Record<string, string | number>) => number,
  ): void {
    const labels = { method, route, status: String(status) };
    this.metrics.httpRequests.inc(labels);
    stop(labels);
  }
}
