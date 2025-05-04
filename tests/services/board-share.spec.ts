import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BoardService } from '~/services/board-service';

declare global {
  // mock fetch globally
  var fetch: any;
}

describe('BoardService multi-user methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('listBoardMembers returns parsed JSON when response is ok', async () => {
    const fakeMembers = [{ id: '1', name: 'Alice', email: 'alice@example.com', joinedAt: '2023-01-01T00:00:00Z' }];
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeMembers });
    const result = await BoardService.listBoardMembers('board1');
    expect(fetch).toHaveBeenCalledWith('/api/boards/board1/members');
    expect(result).toEqual(fakeMembers);
  });

  it('listBoardMembers throws error when response not ok', async () => {
    (fetch as any).mockResolvedValue({ ok: false, statusText: 'Error' });
    await expect(BoardService.listBoardMembers('board2')).rejects.toThrow('Failed to list board members: Error');
  });

  it('listBoardGroups returns parsed JSON when response is ok', async () => {
    const fakeGroups = [{ id: 'g1', name: 'Team', createdAt: '2023-01-02', updatedAt: '2023-01-03' }];
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeGroups });
    const result = await BoardService.listBoardGroups('board1');
    expect(fetch).toHaveBeenCalledWith('/api/boards/board1/groups');
    expect(result).toEqual(fakeGroups);
  });

  it('listBoardGroups throws error when response not ok', async () => {
    (fetch as any).mockResolvedValue({ ok: false, statusText: 'ErrorGroup' });
    await expect(BoardService.listBoardGroups('boardX')).rejects.toThrow('Failed to list board groups: ErrorGroup');
  });

  it('listGroups returns parsed JSON when response is ok', async () => {
    const fakeUserGroups = [{ id: 'u1', name: 'Org', members: [] }];
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeUserGroups });
    const result = await BoardService.listGroups();
    expect(fetch).toHaveBeenCalledWith('/api/groups');
    expect(result).toEqual(fakeUserGroups);
  });

  it('listGroups throws error when response not ok', async () => {
    (fetch as any).mockResolvedValue({ ok: false, statusText: 'ErrorList' });
    await expect(BoardService.listGroups()).rejects.toThrow('Failed to list groups: ErrorList');
  });

  it('joinBoard calls join endpoint and refreshes board', async () => {
    const boardData = { id: 'board1', title: 'B', columns: [], theme: 'light', user: { id: 'u' }, userId: 'u', pinned: false, isPublic: false };
    vi.spyOn(BoardService, 'getBoard').mockResolvedValue(boardData as any);
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const result = await BoardService.joinBoard('board1');
    expect(fetch).toHaveBeenCalledWith('/api/boards/board1/join', { method: 'POST' });
    expect(result).toEqual(boardData);
  });

  it('joinBoard throws when join fails', async () => {
    (fetch as any).mockResolvedValue({ ok: false, statusText: 'JoinError', json: async () => ({ error: 'nope' }) });
    await expect(BoardService.joinBoard('b2')).rejects.toThrow('nope');
  });

  it('inviteUserToBoard calls members endpoint and refreshes board', async () => {
    const boardData = { id: 'board1', title: 'B', columns: [], theme: 'light', user: { id: 'u' }, userId: 'u', pinned: false, isPublic: false };
    vi.spyOn(BoardService, 'getBoard').mockResolvedValue(boardData as any);
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const result = await BoardService.inviteUserToBoard('board1', 'test@mail.com');
    expect(fetch).toHaveBeenCalledWith('/api/boards/board1/members', expect.any(Object));
    expect(result).toEqual(boardData);
  });

  it('shareBoardWithGroup calls groups endpoint and refreshes board', async () => {
    const boardData = { id: 'board1', title: 'B', columns: [], theme: 'light', user: { id: 'u' }, userId: 'u', pinned: false, isPublic: false };
    vi.spyOn(BoardService, 'getBoard').mockResolvedValue(boardData as any);
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const result = await BoardService.shareBoardWithGroup('board1', 'g1');
    expect(fetch).toHaveBeenCalledWith('/api/boards/board1/groups', expect.any(Object));
    expect(result).toEqual(boardData);
  });

  it('createGroup posts to api/groups', async () => {
    const fakeGroup = { id: 'g2', name: 'New' };
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeGroup });
    const result = await BoardService.createGroup('New');
    expect(fetch).toHaveBeenCalledWith('/api/groups', expect.any(Object));
    expect(result).toEqual(fakeGroup);
  });

  it('addUserToGroup posts to api/groups/:id/members', async () => {
    const fakeGroup = { id: 'g2', name: 'Grp' };
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeGroup });
    const result = await BoardService.addUserToGroup('g2', 'u2');
    expect(fetch).toHaveBeenCalledWith('/api/groups/g2/members', expect.any(Object));
    expect(result).toEqual(fakeGroup);
  });

  it('assignUserToCard calls PATCH and returns updated board', async () => {
    const fakeBoard = { id: 'b1', title: 'Board', columns: [] };
    // First getBoard
    vi.spyOn(BoardService, 'getBoard').mockResolvedValue(fakeBoard as any);
    // Mock patch result
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeBoard });
    const result = await BoardService.assignUserToCard('c1', 'u1');
    expect(fetch).toHaveBeenCalledWith('/api/cards/c1', expect.objectContaining({ method: 'PATCH' }));
    expect(result).toEqual(fakeBoard);
  });

  it('setCardMilestone calls PATCH and returns updated board', async () => {
    const fakeBoard = { id: 'b1', title: 'Board', columns: [] };
    (fetch as any).mockResolvedValue({ ok: true, json: async () => fakeBoard });
    const result = await BoardService.setCardMilestone('c1', 'm1');
    expect(fetch).toHaveBeenCalledWith('/api/cards/c1', expect.objectContaining({ method: 'PATCH' }));
    expect(result).toEqual(fakeBoard);
  });
}); 