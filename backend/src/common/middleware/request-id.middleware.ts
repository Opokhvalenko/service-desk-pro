import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Assigns a stable correlation id to every request. Honors an inbound
 * `x-request-id` header (e.g. from a load balancer / upstream service) and
 * falls back to a fresh UUID. The id is exposed on `req.id` for downstream
 * consumers (logger, exception filter) and echoed back on the response.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id =
      (typeof incoming === 'string' && incoming.trim().length > 0 ? incoming : null) ??
      randomUUID();

    req.id = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
