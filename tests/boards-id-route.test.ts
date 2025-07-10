import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '~/lib/prisma';
import type { Mock } from 'vitest';

type PrismaMock = {
  board: { findUnique: Mock; update: Mock; delete: Mock };
  label: { upsert: Mock; delete: Mock };
  user: { upsert: Mock };
  $transaction: Mock;
};

const mockedPrisma = prisma as unknown as PrismaMock;
import { PATCH, DELETE, BoardInputSchema } from '~/app/api/boards/[boardId]/[id]/route';

// Mock Prisma methods
vi.mock('~/lib/prisma', () => ({
  default: {
    board: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    label: { upsert: vi.fn(), delete: vi.fn() },
    user: { upsert: vi.fn() },
  },
}));

// Extend mock for transaction testing
interface TxMock {
  board: { update: Mock };
  column: { update: Mock; delete: Mock };
  card: { update: Mock; delete: Mock };
  label: { upsert: Mock; delete: Mock };
  comment: { update: Mock; delete: Mock };
  attachment: { upsert: Mock; delete: Mock };
}
const mockTx: TxMock = {
  board: { update: vi.fn() },
  column: { update: vi.fn(), delete: vi.fn() },
  card: { update: vi.fn(), delete: vi.fn() },
  label: { upsert: vi.fn(), delete: vi.fn() },
  comment: { update: vi.fn(), delete: vi.fn() },
  attachment: { upsert: vi.fn(), delete: vi.fn() },
};
(prisma as unknown as { $transaction: (fn: (tx: TxMock) => Promise<unknown>) => Promise<unknown> }).$transaction = vi.fn().mockImplementation(async (callback: (tx: TxMock) => Promise<unknown>) => {
  try {
    return await callback(mockTx);
  } catch (error) {
    // Simulate transaction rollback on error
    throw error;
  }
});

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
    expect(() => BoardInputSchema.parse(invalid as unknown)).toThrow();
  });
});

describe('PATCH /api/boards/[id]', () => {
  const boardId = 'b1';
  const initialBoardState = {
    id: boardId,
    title: 'Initial Title',
    theme: 'dark',
    columns: [
      { id: 'c1', title: 'Col 1', order: 0, cards: [{ id: 'card1', title: 'Card 1', order: 0, labels: [{ id: 'l1', name: 'Label 1' }] }] },
      { id: 'c2', title: 'Col 2', order: 1, cards: [] },
    ],
    labels: [{ id: 'l1', name: 'Label 1' }, { id: 'l2', name: 'Label 2' }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset transaction mocks
    Object.values(mockTx).forEach(model => {
      Object.values(model).forEach(fn => fn.mockReset());
    });
    mockedPrisma.board.findUnique.mockResolvedValue(initialBoardState);
    mockedPrisma.$transaction.mockClear();
    mockTx.board.update.mockResolvedValue({});
    mockTx.column.update.mockResolvedValue({});
    mockTx.column.delete.mockResolvedValue({});
    mockTx.card.update.mockResolvedValue({});
    mockTx.card.delete.mockResolvedValue({});
    mockTx.label.upsert.mockResolvedValue({});
    mockTx.label.delete.mockResolvedValue({});
    mockTx.comment.update.mockResolvedValue({});
    mockTx.comment.delete.mockResolvedValue({});
    mockTx.attachment.upsert.mockResolvedValue({});
    mockTx.attachment.delete.mockResolvedValue({});
  });

  it('returns 404 when board not found', async () => {
    mockedPrisma.board.findUnique.mockResolvedValue(null);
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify({ title: 'New Title' }) });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({ error: 'Board not found' });
  });

  it('updates board and returns success', async () => {
    const simplePatch = { title: 'Valid Update' };
    mockedPrisma.board.findUnique.mockResolvedValue({ id: boardId, title: 'Old Title', theme: 'dark', columns: [] });
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify(simplePatch) });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.board.update).toHaveBeenCalledWith({ where: { id: boardId }, data: simplePatch });
  });

  it('handles complex merge patch successfully', async () => {
    const complexPatch = {
      title: 'Updated Board Title',
      columns: [
        { id: 'c1', title: 'Updated Column 1' },
        { id: 'c2', _delete: true },
      ],
    };
    mockedPrisma.board.findUnique.mockResolvedValue(initialBoardState);
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify(complexPatch) });
    const res = await PATCH(req, { params: { id: boardId } });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.board.update).toHaveBeenCalledWith({ where: { id: boardId }, data: { title: 'Updated Board Title' } });
    expect(mockTx.column.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { title: 'Updated Column 1' } });
    expect(mockTx.column.delete).toHaveBeenCalledWith({ where: { id: 'c2' } });
  });

  it('handles JSON patch array successfully', async () => {
    const jsonPatchOps = [
      { op: 'replace', path: '/title', value: 'JSON Patched Title' },
      { op: 'remove', path: '/columns/1' },
    ];

    mockedPrisma.board.findUnique.mockResolvedValueOnce(initialBoardState);
    mockedPrisma.board.findUnique.mockResolvedValueOnce(JSON.parse(JSON.stringify(initialBoardState)));

    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify(jsonPatchOps) });
    const res = await PATCH(req, { params: { id: boardId } });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.board.update).toHaveBeenCalledWith({ where: { id: boardId }, data: { title: 'JSON Patched Title', theme: 'dark' } });
  });

  it('returns 400 for invalid patch format (non-object/array)', async () => {
    mockedPrisma.board.findUnique.mockResolvedValue({ id: boardId });
    const req = new Request('https://test', { method: 'PATCH', body: 'invalid-string' });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: 'Invalid request body: Expected JSON' });
  });

  it('returns 400 for malformed merge patch (schema validation fail)', async () => {
    mockedPrisma.board.findUnique.mockResolvedValue({ id: boardId });
    const malformedMerge = { title: 123 };
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify(malformedMerge) });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Patch validation failed');
    expect(json.issues).toBeInstanceOf(Array);
    expect(json.issues[0].code).toBe('invalid_type');
    expect(json.issues[0].path).toEqual(['title']);
  });

  it('returns 500 for malformed JSON patch (invalid op)', async () => {
    mockedPrisma.board.findUnique.mockResolvedValueOnce(initialBoardState);
    mockedPrisma.board.findUnique.mockResolvedValueOnce(JSON.parse(JSON.stringify(initialBoardState)));

    const invalidJsonPatch = [
      { op: 'invalid-op', path: '/title', value: 'test' }
    ];
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify(invalidJsonPatch) });
    const res = await PATCH(req, { params: { id: boardId } });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/Cannot read properties of undefined|invalid op/i);
  });

  it('rolls back transaction on error', async () => {
    const mergePatch = {
      title: 'Should Rollback',
      cards: [{ id: 'card1', title: 'Error Here' }],
    };

    await mockTx.card.update.mockRejectedValueOnce(new Error('Simulated DB Error'));

    mockedPrisma.board.findUnique.mockResolvedValue(initialBoardState);
    const req = new Request('https://test', { method: 'PATCH', body: JSON.stringify(mergePatch) });
    const res = await PATCH(req, { params: { id: boardId } });

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'Simulated DB Error' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.board.update).toHaveBeenCalledWith({ where: { id: boardId }, data: { title: 'Should Rollback' } });
    expect(mockTx.card.update).toHaveBeenCalledWith({ where: { id: 'card1' }, data: { title: 'Error Here' } });
  });
});

describe('DELETE /api/boards/[id]', () => {
  const boardId = 'b2';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on delete', async () => {
    mockedPrisma.board.delete.mockResolvedValue({});
    const req = new Request('https://test', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: boardId } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ success: true });
    expect(prisma.board.delete).toHaveBeenCalledWith({ where: { id: boardId } });
  });

  it('returns 500 on delete error', async () => {
    mockedPrisma.board.delete.mockRejectedValue(new Error('fail'));
    const req = new Request('https://test', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: boardId } });
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json).toEqual({ error: 'fail' });
  });
}); 