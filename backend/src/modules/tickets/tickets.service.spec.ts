import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthenticatedUser } from '../auth';
import type { SlaService } from '../sla/sla.service';
import { TicketsService } from './tickets.service';

const makePrismaMock = () => ({
  ticket: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  ticketComment: { create: jest.fn() },
  user: { findUnique: jest.fn() },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
});

const requester: AuthenticatedUser = {
  id: 'r1',
  email: 'r@x.com',
  fullName: 'R',
  role: 'REQUESTER',
};
const agent: AuthenticatedUser = { id: 'a1', email: 'a@x.com', fullName: 'A', role: 'AGENT' };
const admin: AuthenticatedUser = { id: 'ad1', email: 'ad@x.com', fullName: 'Ad', role: 'ADMIN' };

const baseTicket = {
  id: 't1',
  number: 1,
  title: 'T',
  description: 'D',
  status: 'NEW',
  priority: 'MEDIUM',
  createdById: 'r1',
  assigneeId: null,
  createdBy: { id: 'r1', fullName: 'R', email: 'r@x.com', role: 'REQUESTER' },
  assignee: null,
};

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let events: EventEmitter2;
  let sla: jest.Mocked<Pick<SlaService, 'initializeForTicket' | 'onStatusChange'>>;

  beforeEach(() => {
    prisma = makePrismaMock();
    events = new EventEmitter2();
    jest.spyOn(events, 'emit');
    sla = {
      initializeForTicket: jest.fn().mockResolvedValue(undefined),
      onStatusChange: jest.fn().mockResolvedValue(undefined),
    };
    service = new TicketsService(prisma as never, events, sla as unknown as SlaService);
  });

  describe('create', () => {
    it('persists ticket, calls SLA init, emits event', async () => {
      prisma.ticket.create.mockResolvedValue({ ...baseTicket });
      prisma.ticket.findUniqueOrThrow.mockResolvedValue({ ...baseTicket });

      const result = await service.create({ title: 'T', description: 'D long enough' }, requester);

      expect(prisma.ticket.create).toHaveBeenCalled();
      expect(sla.initializeForTicket).toHaveBeenCalledWith('t1');
      expect(events.emit).toHaveBeenCalledWith(
        'ticket.created',
        expect.objectContaining({ ticketId: 't1' }),
      );
      expect(result.code).toBe('TKT-1');
    });
  });

  describe('list — RBAC scoping', () => {
    beforeEach(() => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
    });

    it('REQUESTER sees only own tickets', async () => {
      await service.list({ page: 1, pageSize: 20 }, requester);
      expect(prisma.ticket.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ createdById: 'r1' }),
      );
    });

    it('AGENT sees assigned + unassigned', async () => {
      await service.list({ page: 1, pageSize: 20 }, agent);
      expect(prisma.ticket.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ OR: [{ assigneeId: 'a1' }, { assigneeId: null }] }),
      );
    });

    it('ADMIN sees everything (no createdById/assigneeId scope)', async () => {
      await service.list({ page: 1, pageSize: 20 }, admin);
      const where = prisma.ticket.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('createdById');
      expect(where).not.toHaveProperty('assigneeId');
    });
  });

  describe('changeStatus', () => {
    it('rejects invalid transition CLOSED → IN_PROGRESS', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ ...baseTicket, status: 'CLOSED' });
      await expect(service.changeStatus('t1', { status: 'IN_PROGRESS' }, agent)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('emits status_changed event and calls sla.onStatusChange on valid transition', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ ...baseTicket, status: 'NEW' });
      prisma.ticket.update.mockResolvedValue({ ...baseTicket, status: 'OPEN' });

      await service.changeStatus('t1', { status: 'OPEN' }, agent);

      expect(sla.onStatusChange).toHaveBeenCalledWith('t1', 'NEW', 'OPEN');
      expect(events.emit).toHaveBeenCalledWith(
        'ticket.status_changed',
        expect.objectContaining({ ticketId: 't1', from: 'NEW', to: 'OPEN' }),
      );
    });
  });

  describe('addComment', () => {
    it('REQUESTER cannot post internal note', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ ...baseTicket, createdById: 'r1' });
      await expect(
        service.addComment('t1', { body: 'hi', isInternal: true }, requester),
      ).rejects.toThrow(ForbiddenException);
    });

    it('AGENT can post internal note and event is emitted', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ ...baseTicket });
      prisma.ticketComment.create.mockResolvedValue({
        id: 'c1',
        ticketId: 't1',
        authorId: 'a1',
        body: 'note',
        isInternal: true,
      });

      await service.addComment('t1', { body: 'note', isInternal: true }, agent);
      expect(events.emit).toHaveBeenCalledWith(
        'ticket.comment_added',
        expect.objectContaining({ ticketId: 't1', isInternal: true }),
      );
    });
  });

  describe('assign', () => {
    it('REQUESTER cannot assign', async () => {
      await expect(service.assign('t1', { assigneeId: 'a1' }, requester)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects assigning to a requester', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ ...baseTicket });
      prisma.user.findUnique.mockResolvedValue({ id: 'r2', role: 'REQUESTER', isActive: true });
      await expect(service.assign('t1', { assigneeId: 'r2' }, admin)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('emits assigned event', async () => {
      prisma.ticket.findUnique.mockResolvedValue({ ...baseTicket });
      prisma.user.findUnique.mockResolvedValue({ id: 'a1', role: 'AGENT', isActive: true });
      prisma.ticket.update.mockResolvedValue({ ...baseTicket, assigneeId: 'a1' });
      await service.assign('t1', { assigneeId: 'a1' }, admin);
      expect(events.emit).toHaveBeenCalledWith(
        'ticket.assigned',
        expect.objectContaining({ ticketId: 't1', assigneeId: 'a1' }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for unknown ticket', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);
      await expect(service.findOne('t999', admin)).rejects.toThrow(NotFoundException);
    });

    it('hides internal comments from REQUESTER', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        ...baseTicket,
        createdById: 'r1',
        comments: [
          { id: 'c1', body: 'public', isInternal: false },
          { id: 'c2', body: 'secret', isInternal: true },
        ],
      });
      const result = await service.findOne('t1', requester);
      expect(result.comments).toHaveLength(1);
      expect(result.comments[0].id).toBe('c1');
    });
  });
});
