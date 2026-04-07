import { TicketPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  description!: string;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
