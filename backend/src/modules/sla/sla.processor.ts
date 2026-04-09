import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SlaService } from './sla.service';

export const SLA_QUEUE = 'sla-checker';
export const SLA_CHECK_JOB = 'sla-check';

@Processor(SLA_QUEUE)
export class SlaProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaProcessor.name);

  constructor(private readonly sla: SlaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== SLA_CHECK_JOB) return;
    try {
      const breached = await this.sla.checkBreaches();
      if (breached > 0) {
        this.logger.log(`Processed ${breached} SLA breaches`);
      }
    } catch (err) {
      // Log full context but rethrow so BullMQ records the failure and the
      // queue's retry/backoff config (see sla.module.ts) takes over instead
      // of the job silently disappearing.
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`SLA scan job failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
