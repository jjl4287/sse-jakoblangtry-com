import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '~/app/api/boards/[boardId]/labels/route';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));

describe('/api/boards/[boardId]/labels', () => {
  const mockGetSession = getServerSession as unknown as ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
  });

  it('lists labels for a board', async () => {
    vi.spyOn(prisma.label, 'findMany').mockResolvedValueOnce([{
      id: 'l1', name: 'Bug', color: '#ff0000', boardId: 'b1'
    } as any]);
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ boardId: 'b1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  });

  it('creates a label', async () => {
    vi.spyOn(prisma.label, 'create').mockResolvedValueOnce({ id: 'l2', name: 'Feature', color: '#00ff00', boardId: 'b1' } as any);
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'Feature', color: '#00ff00' }) });
    const res = await POST(req, { params: Promise.resolve({ boardId: 'b1' }) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty('id', 'l2');
  });
});

