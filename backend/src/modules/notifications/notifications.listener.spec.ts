import { Logger } from '@nestjs/common';
import { NotificationsListener } from './notifications.listener';

const makePrismaMock = () => ({
  ticket: { findUnique: jest.fn() },
  user: { findUnique: jest.fn(), findMany: jest.fn() },
});

const makeNotificationsMock = () => ({ create: jest.fn() });
const makeMailMock = () => ({ send: jest.fn() });

describe('NotificationsListener — failure isolation', () => {
  let listener: NotificationsListener;
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let mail: ReturnType<typeof makeMailMock>;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();
    mail = makeMailMock();
    listener = new NotificationsListener(prisma as never, notifications as never, mail as never);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('onAssigned: swallows DB errors and logs them — never rethrows', async () => {
    prisma.ticket.findUnique.mockRejectedValue(new Error('db down'));
    prisma.user.findUnique.mockResolvedValue({ email: 'a@x.com', fullName: 'A' });

    await expect(
      listener.onAssigned({
        ticketId: 't1',
        assigneeId: 'a1',
        actorId: 'admin1',
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('onStatusChanged: swallows notification.create errors', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      number: 1,
      title: 'T',
      createdById: 'r1',
      assigneeId: 'a1',
    });
    notifications.create.mockRejectedValue(new Error('notification crash'));

    await expect(
      listener.onStatusChanged({
        ticketId: 't1',
        from: 'NEW',
        to: 'OPEN',
        actorId: 'someone',
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });

  it('onCommentAdded: swallows DB errors', async () => {
    prisma.ticket.findUnique.mockRejectedValue(new Error('boom'));

    await expect(
      listener.onCommentAdded({
        ticketId: 't1',
        commentId: 'c1',
        authorId: 'a1',
        isInternal: false,
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });

  it('onSlaBreached: per-recipient mail failure does not abort the loop', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ title: 'T', assigneeId: 'a1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'a1', email: 'a@x.com', fullName: 'A' },
      { id: 'l1', email: 'l@x.com', fullName: 'L' },
    ]);
    mail.send.mockRejectedValueOnce(new Error('smtp 5xx')).mockResolvedValueOnce(undefined);

    await listener.onSlaBreached({
      ticketId: 't1',
      number: 1,
      breachType: 'RESPONSE',
    } as never);

    // Both notifications should still have been created — the mail failure on
    // recipient #1 must NOT prevent recipient #2 from being notified.
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(mail.send).toHaveBeenCalledTimes(2);
  });
});
