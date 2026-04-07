import { TicketPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
