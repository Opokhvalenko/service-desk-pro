import { IsOptional, IsString } from 'class-validator';

export class AssignTicketDto {
  /** Pass null/empty to unassign */
  @IsOptional()
  @IsString()
  assigneeId?: string | null;
}
