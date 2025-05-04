import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardService } from '~/services/board-service';

// --- Mock fetch globally ---
declare global {
  var fetch: any;
}

describe('BoardService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Mock global fetch before each test
    globalThis.fetch = vi.fn();
  });

  // --- Internal Helper Mocks (used for findColumn/findCard tests) ---
  // Expose internal methods for testing
  const TestableBoardService = BoardService as any;
  const mockBoard = {
    id: 'b1',
    title: 'Test Board',
    columns: [
      { id: 'c1', title: 'Col 1', cards: [{ id: 'card1' }] },
      { id: 'c2', title: 'Col 2', cards: [] },
    ],
  };

  describe('Internal Helpers', () => {
    it('findColumn should find a column', () => {
      const { column, index } = TestableBoardService.findColumn(mockBoard, 'c1');
      expect(column.id).toBe('c1');
      expect(index).toBe(0);
    });

    it('findColumn should throw ItemNotFoundError if not found', () => {
      expect(() => TestableBoardService.findColumn(mockBoard, 'c3')).toThrow(
        'Column with ID c3 not found'
      );
    });

    it('findCard should find a card', () => {
      const { card, column, columnIndex, cardIndex } = TestableBoardService.findCard(mockBoard, 'card1');
      expect(card.id).toBe('card1');
      expect(column.id).toBe('c1');
      expect(columnIndex).toBe(0);
      expect(cardIndex).toBe(0);
    });

    it('findCard should throw ItemNotFoundError if not found', () => {
      expect(() => TestableBoardService.findCard(mockBoard, 'card2')).toThrow(
        'Card with ID card2 not found'
      );
    });
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

    it('throws default error when no body error and text() fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request Status', // Provide statusText
        json: async () => { throw new Error('Not JSON'); }, // Simulate JSON parse failure
        text: async () => { throw new Error('Cannot read text'); }, // Simulate text() failure
      });
      // Expect it to fall back to statusText
      await expect(BoardService.createBoard('X')).rejects.toThrow('Bad Request Status');
    });

    it('throws error from text() when JSON fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request Status',
        json: async () => { throw new Error('Not JSON'); },
        text: async () => 'Error from text', // Simulate text() success
      });
      await expect(BoardService.createBoard('X')).rejects.toThrow('Error from text');
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

  describe('saveBoard (via updateTheme)', () => {
    // Test saveBoard indirectly via a method that uses it
    it('throws error from saveBoard when fetch fails (non-JSON response)', async () => {
      // Mock getBoard to return something
      vi.spyOn(BoardService, 'getBoard').mockResolvedValue(mockBoard as any);
      // Mock the saveBoard fetch call to fail
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: async () => { throw new Error('Not JSON'); },
        text: async () => 'Raw server error text',
      });

      await expect(BoardService.updateTheme('dark')).rejects.toThrow('Raw server error text');
    });

    it('throws error from saveBoard when fetch fails (JSON error response)', async () => {
      vi.spyOn(BoardService, 'getBoard').mockResolvedValue(mockBoard as any);
      globalThis.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Client Error',
        json: async () => ({ error: 'Specific Save Error' }),
        text: async () => '',
      });
      await expect(BoardService.updateTheme('light')).rejects.toThrow('Specific Save Error');
    });
  });

  describe('updateColumn', () => {
    it('handles update failure gracefully', async () => {
      // REMOVE this spy for this test, we want getBoard to actually run and call fetch
      // vi.spyOn(BoardService, 'getBoard').mockResolvedValue(mockBoard as any);
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ // First call (updateColumn PATCH) - Fails
          ok: false,
          status: 500,
          statusText: 'Update Column Failed',
        })
        .mockResolvedValueOnce({ // Second call (fetchBoard inside getBoard) - Succeeds
           ok: true,
           json: async () => mockBoard, 
        });
      // Should still fetch board afterwards, even if update fails
      await BoardService.updateColumn('c1', { title: 'New Title' });
      expect(fetch).toHaveBeenCalledTimes(2); // 1 for update, 1 for getBoard
    });
  });

  describe('moveColumn', () => {
    it('throws ItemNotFoundError if column to move is not found', async () => {
      vi.spyOn(BoardService, 'getBoard').mockResolvedValue(mockBoard as any);
      await expect(BoardService.moveColumn('c3', 1)).rejects.toThrow('Column with ID c3 not found');
    });
    // Add tests for fetch failures during order update loop?
  });

  describe('deleteColumn', () => {
    it('calls fetch DELETE and getBoard on success', async () => {
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce({ // First call (DELETE)
                ok: true,
            })
            .mockResolvedValueOnce({ // Second call (getBoard)
                ok: true,
                json: async () => mockBoard,
            });

        await BoardService.deleteColumn('c1');
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenNthCalledWith(1, '/api/columns/c1', { method: 'DELETE' });
        // Check the second call (getBoard -> fetchBoard -> fetch)
        expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/api/boards'));
    });

    it('throws error if fetch DELETE fails', async () => {
        globalThis.fetch = vi.fn()
            .mockResolvedValueOnce({ // First call (DELETE) - Fails
                ok: false,
                status: 500,
                statusText: 'Server Delete Error',
            });

        await expect(BoardService.deleteColumn('c1')).rejects.toThrow('Failed to delete column: Server Delete Error');
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith('/api/columns/c1', { method: 'DELETE' });
    });
  });

  // ... (Consider adding similar error handling tests for Card methods: create, update, move, delete, duplicate)

  // ... (Consider adding error tests for Label, Comment, Attachment methods)
}); 