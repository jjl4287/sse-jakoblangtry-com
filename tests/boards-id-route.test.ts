import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE, BoardInputSchema } from '~/app/api/boards/[boardId]/[id]/route';
import { getServerSession } from 'next-auth/next';
import { boardService } from '~/lib/services/board-service';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));

// Mock the service instead of Prisma internals
vi.mock('~/lib/services/board-service', () => {
  return {
    boardService: {
      updateBoard: vi.fn(),
      deleteBoard: vi.fn(),
    },
  };
});

const mockGetSession = getServerSession as unknown as ReturnType<typeof vi.fn>;
const mockService = boardService as unknown as { updateBoard: ReturnType<typeof vi.fn>, deleteBoard: ReturnType<typeof vi.fn> };

describe('BoardInputSchema', () => {
  it('accepts valid board shape', () => {
    const valid = {
      id: 'b1',
      title: 'Board 1',
      theme: 'light',
      columns: [],
    };
    expect(() => BoardInputSchema.parse(valid)).not.toThrow();
  });
  it('rejects missing title', () => {
    const invalid = { id: 'b1', theme: 'light', columns: [] };
    expect(() => BoardInputSchema.parse(invalid as any)).toThrow();
  });
});

describe('PATCH /api/boards/[id]', () => {
  const boardId = 'b1';

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
  });

  it('returns 404 when board not found', async () => {
    mockService.updateBoard.mockRejectedValueOnce(new Error('Board not found'));
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify({ title: 'New Title' }) });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(404);
  });

  it('updates board and returns success', async () => {
    mockService.updateBoard.mockResolvedValueOnce({ id: boardId, title: 'Valid Update', theme: 'light', columns: [], labels: [], members: [] } as any);
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify({ title: 'Valid Update' }) });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(200);
    expect(mockService.updateBoard).toHaveBeenCalledWith(boardId, { title: 'Valid Update' });
  });

  it('returns 400 for invalid patch format (non-object/array)', async () => {
    const req = new Request('https://test', { method: 'PATCH', body: 'invalid-string' });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/boards/[id]', () => {
  const boardId = 'b2';

  beforeEach(() => vi.resetAllMocks());

  it('returns success on delete', async () => {
    mockService.deleteBoard.mockResolvedValueOnce(undefined);
    const req = new Request('https://test', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: boardId } });
    expect(res.status).toBe(200);
  });

  it('returns 500 on delete error', async () => {
    mockService.deleteBoard.mockRejectedValueOnce(new Error('fail'));
    const req = new Request('https://test', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: boardId } });
    expect(res.status).toBe(500);
  });
});