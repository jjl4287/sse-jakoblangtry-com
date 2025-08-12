import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabelServiceImpl } from '~/lib/services/label-service';
import { NotFoundError, ValidationError } from '~/lib/errors/domain-errors';

describe('LabelService', () => {
  const mockRepo = {
    findById: vi.fn(),
    findByBoardId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteFromBoard: vi.fn(),
  } as any;

  let service: LabelServiceImpl;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabelServiceImpl(mockRepo);
  });

  it('lists labels by board', async () => {
    mockRepo.findByBoardId.mockResolvedValueOnce([]);
    const labels = await service.getBoardLabels('b1');
    expect(labels).toEqual([]);
    expect(mockRepo.findByBoardId).toHaveBeenCalledWith('b1');
  });

  it('validates color hex', async () => {
    await expect(service.createLabel('b1', 'Bug', 'not-a-hex')).rejects.toBeInstanceOf(ValidationError);
  });

  it('creates label', async () => {
    mockRepo.create.mockResolvedValueOnce({ id: 'l1', name: 'Bug', color: '#ff0000', boardId: 'b1' });
    const created = await service.createLabel('b1', 'Bug', '#ff0000');
    expect(created.id).toBe('l1');
    expect(mockRepo.create).toHaveBeenCalledWith({ boardId: 'b1', name: 'Bug', color: '#ff0000' });
  });

  it('updates label when found', async () => {
    mockRepo.findById.mockResolvedValueOnce({ id: 'l1', boardId: 'b1', name: 'Bug', color: '#ff0000' });
    mockRepo.update.mockResolvedValueOnce({ id: 'l1', name: 'Fix', color: '#00ff00', boardId: 'b1' });
    const updated = await service.updateLabel('b1', 'l1', 'Fix', '#00ff00');
    expect(updated.name).toBe('Fix');
    expect(mockRepo.update).toHaveBeenCalledWith('l1', { name: 'Fix', color: '#00ff00' });
  });

  it('throws NotFoundError on update for wrong board', async () => {
    mockRepo.findById.mockResolvedValueOnce({ id: 'l1', boardId: 'other', name: 'Bug', color: '#ff0000' });
    await expect(service.updateLabel('b1', 'l1', 'Fix', '#00ff00')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('deletes label', async () => {
    mockRepo.findById.mockResolvedValueOnce({ id: 'l1', boardId: 'b1', name: 'Bug', color: '#ff0000' });
    await service.deleteLabel('b1', 'l1');
    expect(mockRepo.deleteFromBoard).toHaveBeenCalledWith('b1', 'l1');
  });
});


