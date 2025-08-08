import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '~/app/api/cards/[cardId]/attachments/route';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));

describe('/api/cards/[cardId]/attachments', () => {
  const mockGetSession = getServerSession as unknown as ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
  });

  it('lists attachments for a card', async () => {
    vi.spyOn(prisma.card, 'findUnique').mockResolvedValueOnce({ board: { creatorId: 'u1', members: [] } } as any);
    vi.spyOn(prisma.attachment, 'findMany').mockResolvedValueOnce([]);
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ cardId: 'c1' }) });
    expect(res.status).toBe(200);
  });

  it('creates a link attachment via JSON', async () => {
    vi.spyOn(prisma.card, 'findUnique').mockResolvedValueOnce({ board: { creatorId: 'u1', members: [] } } as any);
    vi.spyOn(prisma.attachment, 'create').mockResolvedValueOnce({ id: 'a1', name: 'Example', url: 'https://ex.com', type: 'link' } as any);
    vi.spyOn(prisma.activityLog, 'create').mockResolvedValueOnce({ id: 'act1' } as any);
    const req = new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://ex.com', name: 'Example' }) });
    const res = await POST(req, { params: Promise.resolve({ cardId: 'c1' }) });
    expect(res.status).toBe(201);
  });
});

