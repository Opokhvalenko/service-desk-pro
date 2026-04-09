import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Category name already exists');
    return this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.requireCategory(id);
    if (dto.name) {
      const conflict = await this.prisma.category.findFirst({
        where: { name: dto.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException('Category name already exists');
    }
    return this.prisma.category.update({
      where: { id },
      data: { name: dto.name, description: dto.description, isActive: dto.isActive },
    });
  }

  async remove(id: string) {
    await this.requireCategory(id);
    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async requireCategory(id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }
}
