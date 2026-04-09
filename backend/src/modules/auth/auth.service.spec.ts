import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

const makePrismaMock = () => ({
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops)),
});

const makeConfigMock = (): Partial<Mocked<ConfigService>> => ({
  getOrThrow: jest.fn((key: string) => {
    const map: Record<string, string> = {
      JWT_ACCESS_SECRET: 'access-secret-test-1234567890',
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '7d',
    };
    return map[key];
  }),
});

const makeJwtMock = (): Partial<Mocked<JwtService>> => ({
  signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let config: Partial<Mocked<ConfigService>>;
  let jwt: Partial<Mocked<JwtService>>;

  beforeEach(() => {
    prisma = makePrismaMock();
    config = makeConfigMock();
    jwt = makeJwtMock();
    service = new AuthService(
      prisma as unknown as never,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(
        service.register({ email: 'a@b.com', password: 'password1', fullName: 'A B' }, {}),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password with argon2id and creates user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const created = {
        id: 'u1',
        email: 'a@b.com',
        passwordHash: 'hash',
        fullName: 'A B',
        role: 'REQUESTER',
        isActive: true,
      };
      prisma.user.create.mockResolvedValue(created);
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(
        { email: 'a@b.com', password: 'password1', fullName: 'A B' },
        { userAgent: 'jest', ipAddress: '127.0.0.1' },
      );

      expect(prisma.user.create).toHaveBeenCalled();
      const passedData = prisma.user.create.mock.calls[0][0].data;
      expect(passedData.email).toBe('a@b.com');
      expect(passedData.role).toBe('REQUESTER');
      // hash should be argon2id
      expect(await argon2.verify(passedData.passwordHash, 'password1')).toBe(true);
      expect(result.tokens.accessToken).toBe('signed.jwt.token');
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      expect(result.user.email).toBe('a@b.com');
    });
  });

  describe('login', () => {
    it('throws on missing user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('x@y.com', 'pass12345', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws on inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false });
      await expect(service.login('x@y.com', 'pass12345', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws on wrong password', async () => {
      const hash = await argon2.hash('correctpw1', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'x@y.com',
        passwordHash: hash,
        fullName: 'X',
        role: 'AGENT',
        isActive: true,
      });
      await expect(service.login('x@y.com', 'wrongpw11', {})).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues tokens and updates lastLoginAt on success', async () => {
      const hash = await argon2.hash('correctpw1', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'x@y.com',
        passwordHash: hash,
        fullName: 'X',
        role: 'AGENT',
        isActive: true,
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login('x@y.com', 'correctpw1', {});

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' }, data: { lastLoginAt: expect.any(Date) } }),
      );
      expect(result.tokens.accessToken).toBe('signed.jwt.token');
      expect(result.user.role).toBe('AGENT');
    });
  });

  describe('refresh', () => {
    it('throws when token not found', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('raw', {})).rejects.toThrow(UnauthorizedException);
    });

    it('detects reuse: revokes all sessions on revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
        user: { id: 'u1', isActive: true },
      });
      await expect(service.refresh('raw', {})).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', revokedAt: null },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });

    it('rotates token on success', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: 'u1',
          email: 'x@y.com',
          passwordHash: 'h',
          fullName: 'X',
          role: 'AGENT',
          isActive: true,
        },
      });
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.refreshToken.update.mockResolvedValue({});

      const result = await service.refresh('raw', {});

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rt1' },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
    });
  });

  describe('changePassword', () => {
    it('rejects new password shorter than 8 chars', async () => {
      await expect(service.changePassword('u1', 'oldpw1234', 'short')).rejects.toThrow(
        /at least 8/,
      );
    });

    it('rejects when current password is wrong', async () => {
      const hash = await argon2.hash('correctpw1', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: hash });
      await expect(service.changePassword('u1', 'wrongpw11', 'newpw1234')).rejects.toThrow(
        /Current password is incorrect/,
      );
    });

    it('updates password AND revokes refresh tokens in a single transaction', async () => {
      const hash = await argon2.hash('correctpw1', { type: argon2.argon2id });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: hash });

      await service.changePassword('u1', 'correctpw1', 'newpw1234');

      // Both writes must go through $transaction — never split, otherwise a
      // crash between them leaves the user with a new password but live
      // refresh tokens.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', revokedAt: null },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });

  describe('logout', () => {
    it('no-ops on missing token', async () => {
      await service.logout(undefined);
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('revokes matching token', async () => {
      await service.logout('raw');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tokenHash: expect.any(String), revokedAt: null },
        }),
      );
    });
  });
});
