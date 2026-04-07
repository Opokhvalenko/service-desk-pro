import { TicketStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
