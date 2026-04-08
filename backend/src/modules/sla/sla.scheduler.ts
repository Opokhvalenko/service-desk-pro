import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SLA_CHECK_JOB, SLA_QUEUE } from './sla.processor';

const EVERY_MINUTE_MS = 60 * 1000;

@Injectable()
export class SlaScheduler implements OnModuleInit {
  private readonly logger = new Logger(SlaScheduler.name);

  constructor(@InjectQueue(SLA_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SLA_CHECK_JOB,
      {},
      {
        repeat: { every: EVERY_MINUTE_MS },
        jobId: 'sla-check-recurring',
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
    this.logger.log(`SLA scheduler registered (every ${EVERY_MINUTE_MS / 1000}s)`);
  }
}
