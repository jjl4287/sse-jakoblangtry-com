import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentServiceImpl } from '~/lib/services/comment-service';
import { NotFoundError, ValidationError } from '~/lib/errors/domain-errors';

describe('CommentService', () => {
  const mockCommentRepo = {
    findById: vi.fn(),
    findByCardId: vi.fn(),
    createForCard: vi.fn(),
    updateContent: vi.fn(),
    delete: vi.fn(),
  } as any;

  const mockActivityRepo = {
    createActivityLog: vi.fn(),
  } as any;

  let service: CommentServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CommentServiceImpl(mockCommentRepo, mockActivityRepo);
  });

  it('throws ValidationError when creating with empty content', async () => {
    await expect(service.createComment('card1', 'user1', '   ')).rejects.toBeInstanceOf(ValidationError);
  });

  it('creates a comment and logs activity', async () => {
    mockCommentRepo.createForCard.mockResolvedValueOnce({ id: 'cm1', content: 'hello', userId: 'user1', cardId: 'card1' });
    const result = await service.createComment('card1', 'user1', 'hello');
    expect(result.id).toBe('cm1');
    expect(mockCommentRepo.createForCard).toHaveBeenCalledWith('card1', 'user1', 'hello');
    expect(mockActivityRepo.createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'ADD_COMMENT', cardId: 'card1', userId: 'user1' }));
  });

  it('throws NotFoundError when updating non-existent comment', async () => {
    mockCommentRepo.findById.mockResolvedValueOnce(null);
    await expect(service.updateComment('cm-missing', 'new', 'user1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ValidationError when updating comment by non-author', async () => {
    mockCommentRepo.findById.mockResolvedValueOnce({ id: 'cm1', content: 'old', userId: 'other', cardId: 'card1' });
    await expect(service.updateComment('cm1', 'new', 'user1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates comment content and logs activity', async () => {
    mockCommentRepo.findById.mockResolvedValueOnce({ id: 'cm1', content: 'old content', userId: 'user1', cardId: 'card1' });
    mockCommentRepo.updateContent.mockResolvedValueOnce({ id: 'cm1', content: 'new content', userId: 'user1', cardId: 'card1' });
    const updated = await service.updateComment('cm1', 'new content', 'user1');
    expect(updated.content).toBe('new content');
    expect(mockCommentRepo.updateContent).toHaveBeenCalledWith('cm1', 'new content');
    expect(mockActivityRepo.createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'UPDATE_COMMENT', cardId: 'card1', userId: 'user1' }));
  });

  it('throws ValidationError when deleting comment by non-author', async () => {
    mockCommentRepo.findById.mockResolvedValueOnce({ id: 'cm1', content: 'hello', userId: 'other', cardId: 'card1' });
    await expect(service.deleteComment('cm1', 'user1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('deletes comment and logs activity', async () => {
    mockCommentRepo.findById.mockResolvedValueOnce({ id: 'cm1', content: 'hello world', userId: 'user1', cardId: 'card1' });
    mockCommentRepo.delete.mockResolvedValueOnce(undefined);
    await service.deleteComment('cm1', 'user1');
    expect(mockActivityRepo.createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'DELETE_COMMENT', cardId: 'card1', userId: 'user1' }));
    expect(mockCommentRepo.delete).toHaveBeenCalledWith('cm1');
  });
});


