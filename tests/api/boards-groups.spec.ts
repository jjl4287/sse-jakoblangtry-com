// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, ShareGroupSchema } from '~/app/api/boards/[id]/groups/route';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
// Mock prisma
vi.mock('~/lib/prisma', () => ({
  default: {
    boardGroup: {
      findMany: vi.fn(),
      create: vi.fn()
    }
  }
}));
import prisma from '~/lib/prisma';

describe('boards/[id]/groups API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request('https://example.com/api/boards/b1/groups'), { params: Promise.resolve({ id: 'b1' }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('POST returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(new Request('https://example.com/api/boards/b1/groups', { method: 'POST', body: JSON.stringify({ groupId: 'g1' }) }), { params: Promise.resolve({ id: 'b1' }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('POST returns 400 on invalid payload', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1' } });
    const badReq = new Request('https://example.com/api/boards/b1/groups', { method: 'POST', body: JSON.stringify({}) });
    const res = await POST(badReq, { params: Promise.resolve({ id: 'b1' }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid groupId' });
  });

  it('ShareGroupSchema parses valid payload', () => {
    const data = { groupId: 'g1' };
    expect(ShareGroupSchema.parse(data)).toEqual(data);
  });

  it('ShareGroupSchema throws on invalid payload', () => {
    expect(() => ShareGroupSchema.parse({ groupId: 123 })).toThrow();
  });
}); 