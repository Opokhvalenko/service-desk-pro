import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AuditService } from './audit.service';

const makePrismaMock = () => ({
  ticket: { findUnique: jest.fn() },
  auditLog: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn(),
    $transaction: jest.fn(),
  },
  $transaction: jest.fn(),
});

const requester: AuthenticatedUser = {
  id: 'r1',
  email: 'r@x.com',
  fullName: 'R',
  role: 'REQUESTER',
};
const otherRequester: AuthenticatedUser = {
  id: 'r2',
  email: 'r2@x.com',
  fullName: 'R2',
  role: 'REQUESTER',
};
const agent: AuthenticatedUser = { id: 'a1', email: 'a@x.com', fullName: 'A', role: 'AGENT' };
const otherAgent: AuthenticatedUser = {
  id: 'a2',
  email: 'a2@x.com',
  fullName: 'A2',
  role: 'AGENT',
};
const admin: AuthenticatedUser = { id: 'ad1', email: 'ad@x.com', fullName: 'Ad', role: 'ADMIN' };
const lead: AuthenticatedUser = {
  id: 'l1',
  email: 'l@x.com',
  fullName: 'L',
  role: 'TEAM_LEAD',
};

describe('AuditService.listForTicket — IDOR guard', () => {
  let service: AuditService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AuditService(prisma as never);
  });

  it('throws NotFound for unknown ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);
    await expect(service.listForTicket('missing', admin)).rejects.toThrow(NotFoundException);
  });

  it('admin can read history for any ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ createdById: 'r1', assigneeId: 'a1' });
    await expect(service.listForTicket('t1', admin)).resolves.toEqual([]);
  });

  it('team lead can read history for any ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ createdById: 'r1', assigneeId: 'a1' });
    await expect(service.listForTicket('t1', lead)).resolves.toEqual([]);
  });

  it('requester can read history of OWN ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ createdById: 'r1', assigneeId: 'a1' });
    await expect(service.listForTicket('t1', requester)).resolves.toEqual([]);
  });

  it("requester is FORBIDDEN from reading history of someone else's ticket", async () => {
    prisma.ticket.findUnique.mockResolvedValue({ createdById: 'r1', assigneeId: 'a1' });
    await expect(service.listForTicket('t1', otherRequester)).rejects.toThrow(ForbiddenException);
  });

  it('agent can read history of ticket assigned to them', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ createdById: 'r1', assigneeId: 'a1' });
    await expect(service.listForTicket('t1', agent)).resolves.toEqual([]);
  });

  it('agent can read history of unassigned ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ createdById: 'r1', assigneeId: null });
    await expect(service.listForTicket('t1', agent)).resolves.toEqual([]);
  });

  it('agent is FORBIDDEN from reading history of ticket assigned to OTHER agent', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ createdById: 'r1', assigneeId: 'a1' });
    await expect(service.listForTicket('t1', otherAgent)).rejects.toThrow(ForbiddenException);
  });
});
