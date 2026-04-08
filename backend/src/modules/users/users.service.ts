import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';
import * as argon2 from 'argon2';
import type { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return users.map(this.toPublic);
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toPublic(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    await this.requireUser(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        role: dto.role,
        isActive: dto.isActive,
      },
    });
    // If user is being deactivated, revoke their refresh tokens
    if (dto.isActive === false) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return this.toPublic(user);
  }

  async deactivate(id: string): Promise<PublicUser> {
    return this.update(id, { isActive: false });
  }

  private async requireUser(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private toPublic(user: User): PublicUser {
    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }
}
