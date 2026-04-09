import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CreateTeamDto } from './dto/create-team.dto';
import type { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.team.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        lead: { select: { id: true, fullName: true, email: true, role: true } },
        _count: { select: { members: true, tickets: true } },
      },
    });
  }

  async create(dto: CreateTeamDto) {
    const existing = await this.prisma.team.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Team name already exists');
    if (dto.leadId) await this.requireLead(dto.leadId);
    return this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description,
        leadId: dto.leadId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateTeamDto) {
    await this.requireTeam(id);
    if (dto.name) {
      const conflict = await this.prisma.team.findFirst({ where: { name: dto.name, NOT: { id } } });
      if (conflict) throw new ConflictException('Team name already exists');
    }
    if (dto.leadId) await this.requireLead(dto.leadId);
    return this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        leadId: dto.leadId,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.requireTeam(id);
    return this.prisma.team.update({ where: { id }, data: { isActive: false } });
  }

  private async requireTeam(id: string) {
    const t = await this.prisma.team.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Team not found');
    return t;
  }

  private async requireLead(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new BadRequestException('Lead user not found');
    if (u.role !== 'TEAM_LEAD' && u.role !== 'ADMIN') {
      throw new BadRequestException('Lead must have TEAM_LEAD or ADMIN role');
    }
    return u;
  }
}
