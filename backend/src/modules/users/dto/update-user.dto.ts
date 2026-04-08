import type { UserRole } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const ROLES: UserRole[] = ['ADMIN', 'TEAM_LEAD', 'AGENT', 'REQUESTER'];

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
