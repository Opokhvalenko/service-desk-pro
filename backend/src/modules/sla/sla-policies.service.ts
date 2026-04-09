import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { UpsertSlaPolicyDto } from './dto/upsert-sla-policy.dto';

@Injectable()
export class SlaPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.slaPolicy.findMany({ orderBy: { priority: 'asc' } });
  }

  upsert(dto: UpsertSlaPolicyDto) {
    return this.prisma.slaPolicy.upsert({
      where: { priority: dto.priority },
      create: {
        priority: dto.priority,
        firstResponseHours: dto.firstResponseHours,
        resolveHours: dto.resolveHours,
      },
      update: {
        firstResponseHours: dto.firstResponseHours,
        resolveHours: dto.resolveHours,
      },
    });
  }
}
