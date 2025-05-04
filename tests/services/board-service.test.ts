import { describe, it, expect, vi } from 'vitest';
import { BoardService } from '~/services/board-service';
import type { Board, User, Label, Comment, Attachment, Group } from '~/types'; // Import more types

// Mock board data for fetch calls
const mockUser: User = { id: 'user1', name: 'Test User' };
const mockBoard: Board = {
  id: 'board1', title: 'Test Board', theme: 'dark', pinned: false, isPublic: false, user: mockUser, userId: mockUser.id,
  columns: [
    {
      id: 'col1', title: 'Col 1', width: 50, order: 0,
      cards: [
        { 
          id: 'card1', title: 'Card 1', description: '', columnId: 'col1', order: 0, priority: 'medium', 
          labels: [], attachments: [], comments: [], assignees: [] 
        },
      ]
    }
  ]
};

// Add mocks for other types
const mockLabel: Label = { id: 'lbl1', name: 'Test Label', color: '#ff0000' };
const mockComment: Comment = { id: 'cmt1', author: 'Test Author', content: 'Test comment', createdAt: new Date() };
const mockAttachment: Attachment = { id: 'att1', name: 'Test File', url: '/test.txt', type: 'text/plain', createdAt: new Date() };
const mockGroup: Group = { id: 'grp1', name: 'Test Group' };

describe('assignUserToCard()', () => {
  it('patches card with new assignee', async () => {
    globalThis.fetch = vi.fn()
      // 1. Mock initial getBoard inside assignUserToCard
      .mockResolvedValueOnce({ 
        ok: true, 
        json: async () => mockBoard 
      })
      // 2. Mock the PATCH call to /api/cards/:id (include json stub)
      .mockResolvedValueOnce({ 
        ok: true,
        json: async () => ({})
      })
      // 3. Mock the final getBoard call
      .mockResolvedValueOnce({ 
        ok: true, 
        json: async () => ({ ...mockBoard, /* potentially updated data */ }) 
      });
      
    await expect(BoardService.assignUserToCard('card1', 'user1')).resolves.toBeDefined();
    
    // Check the PATCH call specifically
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/cards/card1', 
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ assignees: ['user1'] }) // Check that the correct assignee list is sent
      })
    );
    // Check total fetch calls (initial getBoard + PATCH + final getBoard)
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('throws error when assignUser fails (PATCH fails)', async () => {
    globalThis.fetch = vi.fn()
       // 1. Mock initial getBoard (successful)
      .mockResolvedValueOnce({ 
        ok: true, 
        json: async () => mockBoard 
      })
      // 2. Mock the PATCH call (failed)
      .mockResolvedValueOnce({ 
        ok: false, 
        statusText: 'API Error', 
        json: async () => ({ error: 'Failed from API' }) // Mock error body 
      });
      
    // Expect the specific error message from the failed PATCH
    await expect(BoardService.assignUserToCard('card1', 'user1')).rejects.toThrow('Failed from API');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // Initial getBoard + failed PATCH
  });

  it('throws error when initial getBoard fails', async () => {
    globalThis.fetch = vi.fn()
       // 1. Mock initial getBoard (failed)
      .mockResolvedValueOnce({ 
        ok: false, 
        statusText: 'Get Board Error' 
      });
      
    // Should throw error from the first getBoard call
    await expect(BoardService.assignUserToCard('card1', 'user1')).rejects.toThrow('Failed to fetch boards list: undefined');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // Only the initial getBoard
  });

});

describe('setCardMilestone()', () => {
  it('patches card with milestone and returns updated board', async () => {
    // This method DOES patch the card directly, then gets the board
    globalThis.fetch = vi.fn()
       // 1. Mock the PATCH to /api/cards/:id
      .mockResolvedValueOnce({ ok: true, json: async () => ({ /* Updated card data */ }) })
      // 2. Mock the final getBoard call
      .mockResolvedValueOnce({ ok: true, json: async () => mockBoard });
      
    await expect(BoardService.setCardMilestone('card1', 'ms1')).resolves.toEqual(mockBoard);
    
    expect(globalThis.fetch).toHaveBeenCalledWith(
        `/api/cards/card1`,
        expect.objectContaining({ 
            method: 'PATCH',
            body: JSON.stringify({ milestoneId: 'ms1' })
        })
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // PATCH card + getBoard
  });

  it('throws error when setCardMilestone fails (PATCH fails)', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ 
        ok: false, 
        statusText: 'API Error',
        json: async () => ({ error: 'Failed from API' }) 
      });
      
    await expect(BoardService.setCardMilestone('card1', 'ms1')).rejects.toThrow('Failed from API');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // Only the failed PATCH
  });
});

// --- NEW TESTS START HERE ---

describe('addLabel()', () => {
  it('gets board, modifies, saves board, and returns updated board', async () => {
    // Mock fetch: 1. getBoard, 2. saveBoard (PATCH /api/boards/:id)
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockBoard }) // Initial getBoard
      .mockResolvedValueOnce({ ok: true }); // saveBoard PATCH success

    // The method returns the *modified* board data directly, not from a final fetch
    const result = await BoardService.addLabel('card1', mockLabel.name, mockLabel.color);
    expect(result.columns[0].cards[0].labels).toEqual(expect.arrayContaining([expect.objectContaining({ name: mockLabel.name })]));
    
    // Check the saveBoard call (PATCH /api/boards/:id)
    const saveBoardCall = (globalThis.fetch as any).mock.calls[1];
    expect(saveBoardCall[0]).toBe(`/api/boards/${mockBoard.id}`);
    expect(saveBoardCall[1].method).toBe('PATCH');
    const savedBoard = JSON.parse(saveBoardCall[1].body);
    expect(savedBoard.columns[0].cards[0].labels[0].name).toBe(mockLabel.name);
    expect(savedBoard.columns[0].cards[0].labels[0].color).toBe(mockLabel.color);

    // Only 2 calls: getBoard + saveBoard
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws error when addLabel fails (saveBoard fails)', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockBoard }) // Initial getBoard
      .mockResolvedValueOnce({ 
        ok: false, 
        statusText: 'Save Error', 
        json: async () => ({ error: 'Failed to save board with label' })
      }); 

    await expect(BoardService.addLabel('card1', 'NewLabel', '#00ff00')).rejects.toThrow('Failed to save board with label');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2); // getBoard + failed saveBoard
  });
});

describe('removeLabel()', () => {
  it('gets board, modifies, saves board, and returns updated board', async () => {
    const boardWithLabel = {
      ...mockBoard,
      columns: [{
        ...mockBoard.columns[0],
        cards: [{ ...mockBoard.columns[0].cards[0], labels: [mockLabel] }]
      }]
    };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => boardWithLabel }) // Initial getBoard
      .mockResolvedValueOnce({ ok: true }); // saveBoard PATCH success

    const result = await BoardService.removeLabel('card1', 'lbl1');
    expect(result.columns[0].cards[0].labels).toEqual([]); // Check returned board

    const saveBoardCall = (globalThis.fetch as any).mock.calls[1];
    expect(saveBoardCall[0]).toBe(`/api/boards/${mockBoard.id}`);
    expect(saveBoardCall[1].method).toBe('PATCH');
    const savedBoard = JSON.parse(saveBoardCall[1].body);
    expect(savedBoard.columns[0].cards[0].labels).toEqual([]); // Check saved board

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  // Error test remains the same
  it('throws error when removeLabel fails (saveBoard fails)', async () => {
     const boardWithLabel = {
      ...mockBoard,
      columns: [{
        ...mockBoard.columns[0],
        cards: [{ ...mockBoard.columns[0].cards[0], labels: [mockLabel] }]
      }]
    };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => boardWithLabel }) 
      .mockResolvedValueOnce({ 
          ok: false, 
          statusText: 'Save Error', 
          json: async () => ({ error: 'Failed to save board without label' }) 
       }); 
    await expect(BoardService.removeLabel('card1', 'lbl1')).rejects.toThrow('Failed to save board without label');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('addComment()', () => {
  it('gets board, modifies, saves board, and returns updated board', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockBoard }) // Initial getBoard
      .mockResolvedValueOnce({ ok: true }); // saveBoard PATCH success

    const result = await BoardService.addComment('card1', mockComment.author, mockComment.content);
    expect(result.columns[0].cards[0].comments[0].content).toBe(mockComment.content);

    const saveBoardCall = (globalThis.fetch as any).mock.calls[1];
    expect(saveBoardCall[0]).toBe(`/api/boards/${mockBoard.id}`);
    expect(saveBoardCall[1].method).toBe('PATCH');
    const savedBoard = JSON.parse(saveBoardCall[1].body);
    expect(savedBoard.columns[0].cards[0].comments[0].content).toBe(mockComment.content);
    expect(savedBoard.columns[0].cards[0].comments[0].author).toBe(mockComment.author);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  // Error test remains the same
  it('throws error when addComment fails (saveBoard fails)', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockBoard }) 
      .mockResolvedValueOnce({ 
          ok: false, 
          statusText: 'Save Error', 
          json: async () => ({ error: 'Failed to save comment' }) 
       }); 
    await expect(BoardService.addComment('card1', 'UserX', 'Comment text')).rejects.toThrow('Failed to save comment');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('deleteComment()', () => {
  it('gets board, modifies, saves board, and returns updated board', async () => {
     const boardWithComment = {
      ...mockBoard,
      columns: [{
        ...mockBoard.columns[0],
        cards: [{ ...mockBoard.columns[0].cards[0], comments: [mockComment] }]
      }]
    };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => boardWithComment }) // Initial getBoard
      .mockResolvedValueOnce({ ok: true }); // saveBoard PATCH success

    const result = await BoardService.deleteComment('card1', 'cmt1');
    expect(result.columns[0].cards[0].comments).toEqual([]); // Check returned

    const saveBoardCall = (globalThis.fetch as any).mock.calls[1];
    expect(saveBoardCall[0]).toBe(`/api/boards/${mockBoard.id}`);
    expect(saveBoardCall[1].method).toBe('PATCH');
    const savedBoard = JSON.parse(saveBoardCall[1].body);
    expect(savedBoard.columns[0].cards[0].comments).toEqual([]); // Check saved

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  // Error test remains the same
  it('throws error when deleteComment fails (saveBoard fails)', async () => {
     const boardWithComment = {
      ...mockBoard,
      columns: [{
        ...mockBoard.columns[0],
        cards: [{ ...mockBoard.columns[0].cards[0], comments: [mockComment] }]
      }]
    };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => boardWithComment }) 
      .mockResolvedValueOnce({ 
          ok: false, 
          statusText: 'Save Error', 
          json: async () => ({ error: 'Failed to delete comment' }) 
      }); 
    await expect(BoardService.deleteComment('card1', 'cmt1')).rejects.toThrow('Failed to delete comment');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});


describe('addAttachment()', () => {
  it('gets board, modifies, saves board, and returns updated board', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockBoard }) // Initial getBoard
      .mockResolvedValueOnce({ ok: true }); // saveBoard PATCH success

    const result = await BoardService.addAttachment('card1', mockAttachment.name, mockAttachment.url, mockAttachment.type);
    expect(result.columns[0].cards[0].attachments[0].name).toBe(mockAttachment.name); // Check returned

    const saveBoardCall = (globalThis.fetch as any).mock.calls[1];
    expect(saveBoardCall[0]).toBe(`/api/boards/${mockBoard.id}`);
    expect(saveBoardCall[1].method).toBe('PATCH');
    const savedBoard = JSON.parse(saveBoardCall[1].body);
    expect(savedBoard.columns[0].cards[0].attachments[0].name).toBe(mockAttachment.name);
    expect(savedBoard.columns[0].cards[0].attachments[0].url).toBe(mockAttachment.url); // Check saved

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  // Error test remains the same
  it('throws error when addAttachment fails (saveBoard fails)', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mockBoard }) 
      .mockResolvedValueOnce({ 
          ok: false, 
          statusText: 'Save Error', 
          json: async () => ({ error: 'Failed to add attachment' }) 
       });
    await expect(BoardService.addAttachment('card1', 'file.jpg', '/uploads/file.jpg', 'image/jpeg')).rejects.toThrow('Failed to add attachment');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('deleteAttachment()', () => {
  it('gets board, modifies, saves board, and returns updated board', async () => {
     const boardWithAttachment = {
      ...mockBoard,
      columns: [{
        ...mockBoard.columns[0],
        cards: [{ ...mockBoard.columns[0].cards[0], attachments: [mockAttachment] }]
      }]
    };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => boardWithAttachment }) // Initial getBoard
      .mockResolvedValueOnce({ ok: true }); // saveBoard PATCH success

    const result = await BoardService.deleteAttachment('card1', 'att1');
    expect(result.columns[0].cards[0].attachments).toEqual([]); // Check returned

    const saveBoardCall = (globalThis.fetch as any).mock.calls[1];
    expect(saveBoardCall[0]).toBe(`/api/boards/${mockBoard.id}`);
    expect(saveBoardCall[1].method).toBe('PATCH');
    const savedBoard = JSON.parse(saveBoardCall[1].body);
    expect(savedBoard.columns[0].cards[0].attachments).toEqual([]); // Check saved

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  // Error test remains the same
   it('throws error when deleteAttachment fails (saveBoard fails)', async () => {
      const boardWithAttachment = {
      ...mockBoard,
      columns: [{
        ...mockBoard.columns[0],
        cards: [{ ...mockBoard.columns[0].cards[0], attachments: [mockAttachment] }]
      }]
    };
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => boardWithAttachment }) 
      .mockResolvedValueOnce({ 
          ok: false, 
          statusText: 'Save Error', 
          json: async () => ({ error: 'Failed to delete attachment' }) 
      }); 
    await expect(BoardService.deleteAttachment('card1', 'att1')).rejects.toThrow('Failed to delete attachment');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('inviteUserToBoard()', () => {
  it('posts invite and returns updated board from final getBoard', async () => {
    globalThis.fetch = vi.fn()
      // Mock POST to the members endpoint - response content doesn't matter here
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Invited' }) }) 
      // Mock final getBoard call - this is what the service method returns
      .mockResolvedValueOnce({ ok: true, json: async () => mockBoard });

    await expect(BoardService.inviteUserToBoard('board1', 'test@example.com')).resolves.toEqual(mockBoard);
    
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/boards/board1/members',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      })
    );
    // Check the second call was getBoard
    const getBoardCall = (globalThis.fetch as any).mock.calls[1];
    expect(getBoardCall[0]).toContain(`/api/boards`); // fetchBoard constructs URL
    expect(getBoardCall[1]).toBeUndefined(); // GET request has no options

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws error when invite fails (POST fails)', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ 
        ok: false, 
        statusText: 'API Error', 
        json: async () => ({ error: 'Invite failed' }) 
      });

    // Error comes from the failed POST, parsed by the service
    await expect(BoardService.inviteUserToBoard('board1', 'test@example.com')).rejects.toThrow('Invite failed');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); 
  });
});

describe('createGroup()', () => {
  it('posts group and returns new group from JSON response', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValue({ // Use mockResolvedValue for simpler success mock
         ok: true, 
         // Ensure json() returns a promise resolving to the mockGroup
         json: async () => mockGroup 
      });

    const result = await BoardService.createGroup('New Group');
    expect(result).toEqual(mockGroup); 
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/groups',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New Group' }),
      })
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws error when createGroup fails (POST fails)', async () => {
    const errorResponse = { error: 'Group creation failed' };
    globalThis.fetch = vi.fn()
      .mockResolvedValue({ // Mock a resolved promise even for failure, as fetch does
        ok: false, 
        statusText: 'API Error', 
        // Ensure json() returns a promise resolving to the error body
        json: async () => errorResponse
      });

    // Use try/catch or rejects.toThrow to verify the thrown error message
    await expect(BoardService.createGroup('New Group')).rejects.toThrow(errorResponse.error);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('addUserToGroup()', () => {
  it('posts user to group and returns updated group from JSON response', async () => {
    const updatedGroup = { ...mockGroup, members: [{ id: 'gm1', userId: 'user1', user: mockUser, groupId: 'grp1', group: mockGroup }] };
    globalThis.fetch = vi.fn()
      .mockResolvedValue({ 
          ok: true, 
          json: async () => updatedGroup 
      });

    const result = await BoardService.addUserToGroup('grp1', 'user1');
    expect(result).toEqual(updatedGroup); 
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/groups/grp1/members',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ userId: 'user1' }),
      })
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('throws error when addUserToGroup fails (POST fails)', async () => {
     const errorResponse = { error: 'Adding user failed' };
    globalThis.fetch = vi.fn()
      .mockResolvedValue({ 
        ok: false, 
        statusText: 'API Error', 
        json: async () => errorResponse
      });

    await expect(BoardService.addUserToGroup('grp1', 'user1')).rejects.toThrow(errorResponse.error);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('shareBoardWithGroup()', () => {
  it('posts link, then gets and returns updated board', async () => {
    globalThis.fetch = vi.fn()
      // Mock POST success - response ignored by service
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Shared' }) }) 
      // Mock final getBoard call - ensure it returns the mock board correctly
      .mockResolvedValueOnce({ ok: true, json: async () => mockBoard }); 

    await expect(BoardService.shareBoardWithGroup('board1', 'grp1')).resolves.toEqual(mockBoard);
    
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/boards/board1/groups',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ groupId: 'grp1' }),
      })
    );
    const getBoardCall = (globalThis.fetch as any).mock.calls[1];
    expect(getBoardCall[0]).toContain(`/api/boards`);
    expect(getBoardCall[1]).toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws error when share fails (POST fails)', async () => {
     const errorResponse = { error: 'Sharing failed' };
     globalThis.fetch = vi.fn()
       // Mock the failed POST call
      .mockResolvedValue({ 
        ok: false, 
        statusText: 'API Error', 
        json: async () => errorResponse 
      });

    // Expect the error message parsed from the json body
    await expect(BoardService.shareBoardWithGroup('board1', 'grp1')).rejects.toThrow(errorResponse.error);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); 
  });
}); 