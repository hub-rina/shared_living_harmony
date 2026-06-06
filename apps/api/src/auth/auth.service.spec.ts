import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('token'), verifyAsync: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('secret'), get: jest.fn().mockReturnValue('15m') };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('rejects login with wrong password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'a@b.c',
      passwordHash: await bcrypt.hash('right', 4),
    });

    await expect(service.login({ email: 'a@b.c', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects login when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.login({ email: 'x@y.z', password: 'pw' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('issues tokens with systemRole in payload on login', async () => {
    const passwordHash = await bcrypt.hash('pass', 4);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.c',
      name: 'Alice',
      systemRole: 'user',
      createdAt: new Date(),
      passwordHash,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.login({ email: 'a@b.c', password: 'pass' });

    const [accessPayload] = jwt.signAsync.mock.calls[0];
    expect(accessPayload).toMatchObject({ sub: 'u1', email: 'a@b.c', systemRole: 'user' });
    expect(accessPayload).not.toHaveProperty('role');
    expect(result.user).toMatchObject({ systemRole: 'user' });
  });

  it('register does not set role explicitly', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u2',
      email: 'new@b.c',
      name: 'New',
      systemRole: 'user',
      createdAt: new Date(),
    });
    prisma.user.update.mockResolvedValue({});

    await service.register({ email: 'new@b.c', password: 'password1', name: 'New' });

    const [createCall] = prisma.user.create.mock.calls[0];
    expect(createCall.data).not.toHaveProperty('role');
  });
});
