import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { LoggerModule } from 'nestjs-pino';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { validateEnv } from './config/env.validation';
import { CloudinaryModule } from './infrastructure/cloudinary/cloudinary.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { HealthModule } from './modules/health/health.module';
import { MailModule } from './modules/mail/mail.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SlaModule } from './modules/sla/sla.module';
import { StatsModule } from './modules/stats/stats.module';
import { TeamsModule } from './modules/teams/teams.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Reuse the correlation id assigned by RequestIdMiddleware so HTTP logs
        // and the error envelope (`error.requestId`) line up for tracing.
        genReqId: (req, res) => {
          const existing = (req as { id?: string }).id;
          if (existing) {
            res.setHeader('x-request-id', existing);
            return existing;
          }
          return undefined as unknown as string;
        },
        customProps: (req) => ({ requestId: (req as { id?: string }).id }),
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 100),
      },
    ]),
    EventEmitterModule.forRoot(),
    CqrsModule.forRoot(),
    PrismaModule,
    RedisModule,
    CloudinaryModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    TeamsModule,
    SlaModule,
    TicketsModule,
    AttachmentsModule,
    AuditModule,
    StatsModule,
    ReportsModule,
    MailModule,
    NotificationsModule,
    RealtimeModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
