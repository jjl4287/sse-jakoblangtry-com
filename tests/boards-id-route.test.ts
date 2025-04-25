import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '~/lib/prisma';
import { PATCH, DELETE, BoardInputSchema } from '~/app/api/boards/[id]/route';

// Mock Prisma methods
vi.mock('~/lib/prisma', () => ({
  default: {
    board: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    label: { upsert: vi.fn() },
    user: { upsert: vi.fn() },
  },
}));

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
  const validBoard = { id: boardId, title: 'T1', theme: 'dark', columns: [] };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 404 when board not found', async () => {
    (prisma.board.findUnique as any).mockResolvedValue(null);
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify(validBoard) });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: 'Board not found' });
  });

  it('updates board and returns success', async () => {
    (prisma.board.findUnique as any).mockResolvedValue({ id: boardId, columns: [] });
    (prisma.board.update as any).mockResolvedValue({});
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify(validBoard) });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
    expect(prisma.board.update).toHaveBeenCalled();
  });
});

describe('DELETE /api/boards/[id]', () => {
  const boardId = 'b2';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns success on delete', async () => {
    (prisma.board.delete as any).mockResolvedValue({});
    const req = new Request('https://test', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: boardId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
    expect(prisma.board.delete).toHaveBeenCalledWith({ where: { id: boardId } });
  });

  it('returns 500 on delete error', async () => {
    (prisma.board.delete as any).mockRejectedValue(new Error('fail'));
    const req = new Request('https://test', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: boardId } });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'fail' });
  });
}); 