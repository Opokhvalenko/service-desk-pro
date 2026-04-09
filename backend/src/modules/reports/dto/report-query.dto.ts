import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReportQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() teamId?: string;
}

export class ExportQueryDto extends ReportQueryDto {
  @IsOptional() @IsString() type?: 'tickets' | 'workload' | 'sla';
}
