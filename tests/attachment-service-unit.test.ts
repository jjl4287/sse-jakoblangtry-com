import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentServiceImpl } from '~/lib/services/attachment-service';
import { ValidationError, NotFoundError } from '~/lib/errors/domain-errors';

describe('AttachmentService', () => {
  const mockAttachmentRepo = {
    findById: vi.fn(),
    findByCardId: vi.fn(),
    createForCard: vi.fn(),
    delete: vi.fn(),
  } as any;

  const mockActivityRepo = {
    createActivityLog: vi.fn(),
  } as any;

  let service: AttachmentServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AttachmentServiceImpl(mockAttachmentRepo, mockActivityRepo);
  });

  it('validates link URL protocol', async () => {
    await expect(service.createAttachment('card1', { name: 'bad', url: 'ftp://ex.com', type: 'link' }, 'user1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('creates link attachment and logs activity', async () => {
    mockAttachmentRepo.createForCard.mockResolvedValueOnce({ id: 'a1', name: 'Good', url: 'https://ex.com', type: 'link' });
    const created = await service.createAttachment('card1', { name: 'Good', url: 'https://ex.com', type: 'link' }, 'user1');
    expect(created.id).toBe('a1');
    expect(mockAttachmentRepo.createForCard).toHaveBeenCalledWith('card1', { name: 'Good', url: 'https://ex.com', type: 'link' });
    expect(mockActivityRepo.createActivityLog).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'ADD_ATTACHMENT', cardId: 'card1', userId: 'user1' }));
  });

  it('throws NotFoundError when deleting missing attachment', async () => {
    mockAttachmentRepo.findById.mockResolvedValueOnce(null);
    await expect(service.deleteAttachment('missing', 'user1')).rejects.toBeInstanceOf(NotFoundError);
  });
});


