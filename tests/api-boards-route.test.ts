import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '~/app/api/boards/route';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';

// Mock getServerSession and Prisma client
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('~/lib/services/board-service', () => ({
  boardService: {
    getPublicBoards: vi.fn(),
    getUserBoards: vi.fn(),
    getBoardById: vi.fn(),
    createBoard: vi.fn(),
  },
}));

const mockGetSession = getServerSession as unknown as ReturnType<typeof vi.fn>;
import { boardService } from '~/lib/services/board-service';
const mockService = boardService as unknown as {
  getPublicBoards: ReturnType<typeof vi.fn>,
  getUserBoards: ReturnType<typeof vi.fn>,
  getBoardById: ReturnType<typeof vi.fn>,
  createBoard: ReturnType<typeof vi.fn>,
};

describe('GET /api/boards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns public boards when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const sample = [{ id: '1', title: 'B1', theme: 'light' as const }];
    mockService.getPublicBoards.mockResolvedValue(sample as any);
    const req = new Request('https://test');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(sample);
    expect(mockService.getPublicBoards).toHaveBeenCalled();
  });

  it('returns 404 when boardId provided but not found', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
    mockService.getBoardById.mockResolvedValue(null as any);
    const req = new Request('https://test?boardId=123');
    const res = await GET(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: 'Board not found or access denied' });
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
    mockGetSession.mockResolvedValue({ user: { id: 'u2', name: 'Alice', email: 'a@example.com' } });
    const created = { id: '10', title: 'T', theme: 'light' as const, columns: [], labels: [], members: [] } as any;
    mockService.createBoard.mockResolvedValue(created);
    const req = new Request('https://test', { method: 'POST', body: JSON.stringify({ title: 'T' }) });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: '10', title: 'T', pinned: false, creatorId: 'u2' });
    expect(mockService.createBoard).toHaveBeenCalledWith('T', 'u2');
  });
}); 