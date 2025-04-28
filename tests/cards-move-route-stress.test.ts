import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '~/app/api/cards/[id]/move/route';
import prisma from '~/lib/prisma';

// Fake timers to control backoff delays
vi.useFakeTimers();

describe('POST /api/cards/:id/move retry logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
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