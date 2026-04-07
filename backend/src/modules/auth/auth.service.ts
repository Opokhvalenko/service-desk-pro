import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { RegisterDto } from './dto/register.dto';
import type { AuthenticatedUser, JwtPayload, TokenPair } from './types/auth.types';

interface ClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
    meta: ClientMeta,
  ): Promise<{ user: AuthenticatedUser; tokens: TokenPair }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: 'REQUESTER',
      },
    });

    const tokens = await this.issueTokens(user, meta);
    return { user: this.toAuthUser(user), tokens };
  }

  async login(
    email: string,
    password: string,
    meta: ClientMeta,
  ): Promise<{ user: AuthenticatedUser; tokens: TokenPair }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(user, meta);
    return { user: this.toAuthUser(user), tokens };
  }

  async refresh(
    rawToken: string,
    meta: ClientMeta,
  ): Promise<{ user: AuthenticatedUser; tokens: TokenPair }> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      // Token reuse detection — revoke all user sessions
      if (stored?.userId) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!stored.user.isActive) throw new UnauthorizedException('User inactive');

    // Rotate
    const tokens = await this.issueTokens(stored.user, meta);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: this.hashToken(tokens.refreshToken) },
    });

    return { user: this.toAuthUser(stored.user), tokens };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: User, meta: ClientMeta): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_TTL') as unknown as number,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshTtlDays = this.parseDays(this.config.getOrThrow<string>('JWT_REFRESH_TTL'));
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 500),
        ipAddress: meta.ipAddress?.slice(0, 64),
      },
    });

    return { accessToken, refreshToken, refreshTokenExpiresAt: expiresAt };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDays(ttl: string): number {
    const match = /^(\d+)d$/.exec(ttl);
    if (!match) throw new Error(`JWT_REFRESH_TTL must be in days (e.g. 7d), got: ${ttl}`);
    return Number(match[1]);
  }

  private toAuthUser(user: User): AuthenticatedUser {
    return { id: user.id, email: user.email, role: user.role as UserRole, fullName: user.fullName };
  }
}
