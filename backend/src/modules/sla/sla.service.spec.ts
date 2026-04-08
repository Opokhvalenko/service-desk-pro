import { EventEmitter2 } from '@nestjs/event-emitter';
import { SlaService } from './sla.service';

const HOUR = 60 * 60 * 1000;

const makePrisma = () => ({
  ticket: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  slaPolicy: {
    findUnique: jest.fn(),
  },
});

describe('SlaService', () => {
  let service: SlaService;
  let prisma: ReturnType<typeof makePrisma>;
  let events: EventEmitter2;

  beforeEach(() => {
    prisma = makePrisma();
    events = new EventEmitter2();
    jest.spyOn(events, 'emit');
    service = new SlaService(prisma as never, events);
  });

  describe('initializeForTicket', () => {
    it('sets deadlines from policy hours', async () => {
      const created = new Date('2026-04-08T12:00:00Z');
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        priority: 'HIGH',
        createdAt: created,
      });
      prisma.slaPolicy.findUnique.mockResolvedValue({
        priority: 'HIGH',
        firstResponseHours: 4,
        resolveHours: 24,
      });

      await service.initializeForTicket('t1');

      const data = prisma.ticket.update.mock.calls[0][0].data;
      expect(data.firstResponseDueAt.toISOString()).toBe('2026-04-08T16:00:00.000Z');
      expect(data.resolveDueAt.toISOString()).toBe('2026-04-09T12:00:00.000Z');
    });

    it('skips when no policy exists', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        priority: 'LOW',
        createdAt: new Date(),
      });
      prisma.slaPolicy.findUnique.mockResolvedValue(null);
      await service.initializeForTicket('t1');
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });
  });

  describe('onStatusChange', () => {
    it('marks firstResponseAt on NEW → IN_PROGRESS', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        firstResponseAt: null,
        pausedAt: null,
        firstResponseDueAt: new Date(),
        resolveDueAt: new Date(),
        pausedTotalMs: 0,
      });
      await service.onStatusChange('t1', 'NEW', 'IN_PROGRESS');
      expect(prisma.ticket.update.mock.calls[0][0].data.firstResponseAt).toEqual(expect.any(Date));
    });

    it('starts pause on → WAITING_FOR_CUSTOMER', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        firstResponseAt: new Date(),
        pausedAt: null,
        pausedTotalMs: 0,
        firstResponseDueAt: new Date(),
        resolveDueAt: new Date(),
      });
      await service.onStatusChange('t1', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER');
      expect(prisma.ticket.update.mock.calls[0][0].data.pausedAt).toEqual(expect.any(Date));
    });

    it('resumes and shifts deadlines on WAITING_FOR_CUSTOMER → IN_PROGRESS', async () => {
      const pausedAt = new Date(Date.now() - 2 * HOUR);
      const originalDeadline = new Date('2026-04-08T20:00:00Z');
      prisma.ticket.findUnique.mockResolvedValue({
        id: 't1',
        firstResponseAt: new Date(),
        pausedAt,
        pausedTotalMs: 1000,
        firstResponseDueAt: originalDeadline,
        resolveDueAt: originalDeadline,
      });

      await service.onStatusChange('t1', 'WAITING_FOR_CUSTOMER', 'IN_PROGRESS');

      const data = prisma.ticket.update.mock.calls[0][0].data;
      expect(data.pausedAt).toBeNull();
      expect(data.pausedTotalMs).toBeGreaterThan(1000);
      // Deadline shifted forward by ~2h
      expect(data.firstResponseDueAt.getTime()).toBeGreaterThan(originalDeadline.getTime());
    });
  });

  describe('checkBreaches', () => {
    it('marks tickets as breached and emits event', async () => {
      const past = new Date(Date.now() - 60_000);
      prisma.ticket.findMany.mockResolvedValue([
        {
          id: 't1',
          number: 1,
          firstResponseDueAt: past,
          firstResponseAt: null,
          resolveDueAt: new Date(Date.now() + HOUR),
        },
      ]);

      const count = await service.checkBreaches();

      expect(count).toBe(1);
      expect(prisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't1' }, data: { breachedAt: expect.any(Date) } }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'ticket.sla_breached',
        expect.objectContaining({ ticketId: 't1', breachType: 'response' }),
      );
    });

    it('returns 0 when no candidates', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      expect(await service.checkBreaches()).toBe(0);
      expect(events.emit).not.toHaveBeenCalled();
    });
  });
});
