import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
