import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardService } from '~/services/board-service';

describe('BoardService.getBoard()', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches first board when API returns a list', async () => {
    const boardList = [{ id: '1', title: 'First', pinned: false }];
    const singleBoard = { id: '1', title: 'First', columns: [], theme: 'light' };
    global.fetch = vi.fn()
      // First call returns list
      .mockResolvedValueOnce({ ok: true, json: async () => boardList })
      // Second call returns the full board
      .mockResolvedValueOnce({ ok: true, json: async () => singleBoard });

    const result = await BoardService.getBoard();
    expect(result).toEqual(singleBoard);
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/boards');
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/boards?boardId=1');
  });

  it('throws if no boards available', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    await expect(BoardService.getBoard()).rejects.toThrow('No boards available');
  });

  it('throws when fetch list fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(BoardService.getBoard()).rejects.toThrow('Failed to fetch boards list: 500');
  });
}); 