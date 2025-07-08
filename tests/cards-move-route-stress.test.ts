import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '~/app/api/cards/[cardId]/move/route';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));

// Fake timers to control backoff delays
vi.useFakeTimers();

const mockGetSession = getServerSession as unknown as ReturnType<typeof vi.fn>;

describe('POST /api/cards/:id/move retry logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('retries on P2034 and eventually succeeds', async () => {
    // First two attempts throw conflict, third succeeds
    const conflictErr = { code: 'P2034', message: 'deadlock' };
    const mockErrors = [conflictErr, conflictErr];
    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn) => {
      if (mockErrors.length > 0) {
        throw mockErrors.shift();
      }
      // Simulate transaction callback
      const tx = {
        card: {
          findUnique: async () => ({ id: '1', columnId: 'col1' }),
          findMany: async () => [],
          update: async () => ({}),
        },
      };
      return fn(tx as any);
    });

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ targetColumnId: 'col1', order: 0 }),
    });
    const params = Promise.resolve({ id: '1' });
    // Use real timers when parsing request body
    vi.useRealTimers();
    const responsePromise = POST(request, { params });
    // Switch back to fake timers for backoff delays
    vi.useFakeTimers();

    // Advance timers for backoff delays
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100 * (2 ** 0));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100 * (2 ** 1));
    await Promise.resolve();

    const response = await responsePromise;
    const json = await response.json();
    expect(json).toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('errors after max retries', async () => {
    // Always conflict
    const conflictErr = { code: 'P2034', message: 'deadlock' };
    vi.spyOn(prisma, '$transaction').mockRejectedValue(conflictErr);

    const request = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ targetColumnId: 'col1', order: 0 }),
    });
    const params = Promise.resolve({ id: '1' });
    // Use real timers when parsing request body
    vi.useRealTimers();
    const responsePromise = POST(request, { params });
    // Switch back to fake timers for backoff delays
    vi.useFakeTimers();

    // Advance through all backoff delays
    for (let attempt = 0; attempt < 3; attempt++) {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(100 * (2 ** attempt));
      await Promise.resolve();
    }

    const response = await responsePromise;
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json).toHaveProperty('error');
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
});

// New robust tests for various scenarios
describe('POST /api/cards/:id/move robust behavior under various scenarios', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('parses request body only once regardless of retries', async () => {
    // Arrange
    const conflictErr = { code: 'P2034', message: 'deadlock' };
    const mockErrors = [conflictErr, conflictErr];
    const jsonSpy = vi.fn().mockResolvedValue({ targetColumnId: 'col1', order: 0 });
    const request = new Request('http://localhost', { method: 'POST' }) as any;
    request.json = jsonSpy;
    const params = Promise.resolve({ id: '1' });
    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn) => {
      if (mockErrors.length > 0) throw mockErrors.shift();
      const tx = {
        card: {
          findUnique: async () => ({ id: '1', columnId: 'col1' }),
          findMany: async () => [],
          update: async () => ({}),
        },
      };
      return fn(tx as any);
    });
    // Act
    vi.useRealTimers();
    const responsePromise = POST(request, { params });
    vi.useFakeTimers();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(200);
    await Promise.resolve();
    await responsePromise;
    // Assert
    expect(jsonSpy).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-P2034 errors', async () => {
    // Arrange
    const otherError = { code: 'UNKNOWN', message: 'other' };
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ targetColumnId: 'col1', order: 0 }) });
    const params = Promise.resolve({ id: '1' });
    // Spy on transaction and reject
    const spyTransaction = vi.spyOn(prisma, '$transaction').mockRejectedValue(otherError);

    // Act
    const response = await POST(request, { params });
    const json = await response.json();

    // Assert
    expect(spyTransaction).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(json).toHaveProperty('error', 'other');
  });

  it('returns error when card not found without retries', async () => {
    // Arrange
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ targetColumnId: 'col1', order: 0 }) });
    const params = Promise.resolve({ id: 'missing' });
    // Mock transaction to return no card
    const spyTransaction = vi.spyOn(prisma, '$transaction').mockImplementation(async (fn) => {
      const tx = { card: { findUnique: async () => null } };
      return fn(tx as any);
    });

    // Act
    const response = await POST(request, { params });
    const json = await response.json();

    // Assert
    expect(spyTransaction).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(500);
    expect(json).toHaveProperty('error', 'Card not found');
  });

  it('correctly reorders cards in same column under a conflict and succeeds', async () => {
    // Arrange DB state
    const dbState = {
      cards: [
        { id: 'c1', columnId: 'col1', order: 0 },
        { id: 'c2', columnId: 'col1', order: 1 },
        { id: 'c3', columnId: 'col1', order: 2 },
      ],
    };
    let txnCalls = 0;
    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn) => {
      if (txnCalls === 0) {
        txnCalls++;
        throw { code: 'P2034', message: 'deadlock' };
      }
      txnCalls++;
      const tx = {
        card: {
          findUnique: async ({ where: { id } }: any) => dbState.cards.find((c) => c.id === id)!,
          findMany: async ({ where: { columnId } }: any) =>
            dbState.cards.filter((c) => c.columnId === columnId).sort((a, b) => a.order - b.order),
          update: async ({ where: { id }, data: { order } }: any) => {
            const card = dbState.cards.find((c) => c.id === id)!;
            if (order !== undefined) card.order = order;
            return card;
          },
        },
      };
      return fn(tx as any);
    });
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ targetColumnId: 'col1', order: 2 }) });
    const params = Promise.resolve({ id: 'c2' });
    // Act
    vi.useRealTimers();
    const responsePromise = POST(request, { params });
    vi.useFakeTimers();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    const response = await responsePromise;
    // Assert
    expect(response.status).toBe(200);
    const sorted = dbState.cards.sort((a, b) => a.order - b.order).map((c) => c.id);
    expect(sorted).toEqual(['c1', 'c3', 'c2']);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('correctly moves cards across columns under a conflict and succeeds', async () => {
    // Arrange DB state
    const dbState = {
      cards: [
        { id: 'a1', columnId: 'colA', order: 0 },
        { id: 'a2', columnId: 'colA', order: 1 },
        { id: 'b1', columnId: 'colB', order: 0 },
        { id: 'b2', columnId: 'colB', order: 1 },
      ],
    };
    let txnCalls = 0;
    vi.spyOn(prisma, '$transaction').mockImplementation(async (fn) => {
      if (txnCalls === 0) {
        txnCalls++;
        throw { code: 'P2034', message: 'deadlock' };
      }
      txnCalls++;
      const tx = {
        card: {
          findUnique: async ({ where: { id } }: any) => dbState.cards.find((c) => c.id === id)!,
          findMany: async ({ where: { columnId } }: any) =>
            dbState.cards.filter((c) => c.columnId === columnId).sort((a, b) => a.order - b.order),
          update: async ({ where: { id }, data }: any) => {
            const card = dbState.cards.find((c) => c.id === id)!;
            if (data.column?.connect?.id) card.columnId = data.column.connect.id;
            if (data.order !== undefined) card.order = data.order;
            return card;
          },
        },
      };
      return fn(tx as any);
    });
    const request = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ targetColumnId: 'colB', order: 1 }) });
    const params = Promise.resolve({ id: 'a2' });
    // Act
    vi.useRealTimers();
    const responsePromise = POST(request, { params });
    vi.useFakeTimers();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    const response = await responsePromise;
    // Assert
    expect(response.status).toBe(200);
    const find = (id: string) => dbState.cards.find((c) => c.id === id)!;
    expect(find('a2').columnId).toBe('colB');
    expect(find('a2').order).toBe(1);
    expect(find('b1').order).toBe(0);
    expect(find('b2').order).toBe(2);
    expect(find('a1').order).toBe(0);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
}); 