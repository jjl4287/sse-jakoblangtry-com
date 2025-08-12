import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardServiceImpl } from '~/lib/services/board-service';

describe('BoardService share/delete', () => {
  const mockRepo = {
    findById: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    delete: vi.fn(),
  } as any;

  let service: BoardServiceImpl;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new BoardServiceImpl(mockRepo);
  });

  it('only owner can share', async () => {
    mockRepo.findById.mockResolvedValueOnce({ id: 'b1', members: [{ userId: 'owner', role: 'owner' }] });
    await service.shareBoard('b1', 'user2', 'owner');
    expect(mockRepo.addMember).toHaveBeenCalledWith('b1', 'user2');
  });

  it('share fails if not owner', async () => {
    mockRepo.findById.mockResolvedValueOnce({ id: 'b1', members: [{ userId: 'owner', role: 'owner' }] });
    await expect(service.shareBoard('b1', 'user2', 'not-owner')).rejects.toThrow('Only the board creator can share this board');
  });

  it('delete fails if not owner', async () => {
    mockRepo.findById.mockResolvedValueOnce({ id: 'b1', members: [{ userId: 'owner', role: 'owner' }] });
    await expect(service.deleteBoard('b1', 'not-owner')).rejects.toThrow('Only the board creator can delete this board');
  });
});


