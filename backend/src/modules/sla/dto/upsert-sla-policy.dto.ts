import type { TicketPriority } from '@prisma/client';
import { IsIn, IsInt, Max, Min } from 'class-validator';

const PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export class UpsertSlaPolicyDto {
  @IsIn(PRIORITIES)
  priority!: TicketPriority;

  @IsInt()
  @Min(1)
  @Max(8760)
  firstResponseHours!: number;

  @IsInt()
  @Min(1)
  @Max(8760)
  resolveHours!: number;
}
