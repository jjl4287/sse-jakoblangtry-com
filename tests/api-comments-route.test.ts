import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '~/app/api/cards/[cardId]/comments/route';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));

describe('/api/cards/[cardId]/comments', () => {
  const mockGetSession = getServerSession as unknown as ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
  });

  it('lists comments for a card', async () => {
    vi.spyOn(prisma.card, 'findUnique').mockResolvedValueOnce({ column: { board: { creatorId: 'u1', members: [] } } } as any);
    vi.spyOn(prisma.comment, 'findMany').mockResolvedValueOnce([]);
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ cardId: 'c1' }) } as any);
    expect(res.status).toBe(200);
  });

  it('creates a comment', async () => {
    vi.spyOn(prisma.card, 'findUnique').mockResolvedValueOnce({ column: { board: { creatorId: 'u1', members: [] } } } as any);
    vi.spyOn(prisma.comment, 'create').mockResolvedValueOnce({ id: 'cm1', content: 'hello', user: { id: 'u1' } } as any);
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ content: 'hello' }) });
    const res = await POST(req, { params: Promise.resolve({ cardId: 'c1' }) } as any);
    expect(res.status).toBe(201);
  });
});

