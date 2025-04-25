import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardService } from '~/services/board-service';

describe('BoardService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listBoards()', () => {
    it('returns data when fetch is successful', async () => {
      const mockData = [{ id: '1', title: 'Test Board', pinned: false }];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });

      const boards = await BoardService.listBoards();
      expect(boards).toEqual(mockData);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/boards');
    });

    it('throws an error when fetch fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      await expect(BoardService.listBoards()).rejects.toThrow('Failed to list boards: 500');
    });
  });

  describe('createBoard()', () => {
    it('returns new board on success', async () => {
      const newBoard = { id: '2', title: 'New Board', pinned: false };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => newBoard,
      });

      const result = await BoardService.createBoard('New Board');
      expect(result).toEqual(newBoard);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/boards', expect.objectContaining({ method: 'POST' }));
    });

    it('throws with error message from response body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad Request' }),
      });
      await expect(BoardService.createBoard('Bad')).rejects.toThrow('Bad Request');
    });

    it('throws default error when no body error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({}),
      });
      await expect(BoardService.createBoard('X')).rejects.toThrow('Failed to create board: 400');
    });
  });

  describe('deleteBoard()', () => {
    it('resolves without error when delete succeeds', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      await expect(BoardService.deleteBoard('1')).resolves.toBeUndefined();
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/boards/1', expect.objectContaining({ method: 'DELETE' }));
    });

    it('throws error with message on failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found' }),
      });
      await expect(BoardService.deleteBoard('1')).rejects.toThrow('Not Found');
    });
  });
}); 