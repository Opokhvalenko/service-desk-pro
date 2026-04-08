import type { UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const ROLES: UserRole[] = ['ADMIN', 'TEAM_LEAD', 'AGENT', 'REQUESTER'];

export class CreateUserDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsIn(ROLES)
  role!: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
