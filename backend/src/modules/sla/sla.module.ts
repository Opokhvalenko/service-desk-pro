import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { SLA_QUEUE, SlaProcessor } from './sla.processor';
import { SlaScheduler } from './sla.scheduler';
import { SlaService } from './sla.service';
import { SlaPoliciesController } from './sla-policies.controller';
import { SlaPoliciesService } from './sla-policies.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.getOrThrow<string>('REDIS_URL');
        const u = new URL(url);
        return {
          connection: {
            host: u.hostname,
            port: Number(u.port || 6379),
            username: u.username || undefined,
            password: u.password || undefined,
            tls: u.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: SLA_QUEUE,
      defaultJobOptions: {
        // Cap retries so a persistent failure doesn't loop forever; exponential
        // backoff (2s, 4s, 8s) gives transient DB hiccups room to recover.
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    }),
  ],
  controllers: [SlaPoliciesController],
  providers: [SlaService, SlaPoliciesService, SlaProcessor, SlaScheduler],
  exports: [SlaService],
})
export class SlaModule {}
