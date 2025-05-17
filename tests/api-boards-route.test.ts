import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '~/lib/prisma';
import { GET, POST } from '~/app/api/boards/route';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';

// Mock getServerSession and Prisma client
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('~/lib/prisma', () => ({
  default: {
    board: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: { upsert: vi.fn() },
  },
}));

const mockGetSession = getServerSession as unknown as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as any;

describe('GET /api/boards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns public boards when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const sample = [{ id: '1', title: 'B1', pinned: false }];
    mockPrisma.board.findMany.mockResolvedValue(sample);
    const req = new Request('https://test');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(sample);
    expect(mockPrisma.board.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isPublic: true } }));
  });

  it('returns 404 when boardId provided but not found', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockPrisma.board.findUnique.mockResolvedValue(null);
    const req = new Request('https://test?boardId=123');
    const res = await GET(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: 'No board found' });
  });
});

describe('POST /api/boards', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const req = new Request('https://test', { method: 'POST', body: JSON.stringify({ title: 'X' }) });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('creates board when authenticated', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u2', name: 'Alice' } });
    const newBoard = { id: '10', title: 'T', pinned: false };
    mockPrisma.user.upsert.mockResolvedValue({});
    mockPrisma.board.create.mockResolvedValue(newBoard);
    const req = new Request('https://test', { method: 'POST', body: JSON.stringify({ title: 'T' }) });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(newBoard);
    expect(mockPrisma.user.upsert).toHaveBeenCalled();
    expect(mockPrisma.board.create).toHaveBeenCalledWith({ data: { title: 'T', userId: 'u2' } });
  });
}); 