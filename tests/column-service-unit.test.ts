import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ColumnServiceImpl } from '~/lib/services/column-service';
import { NotFoundError, ValidationError } from '~/lib/errors/domain-errors';

describe('ColumnService', () => {
  const mockColumnRepo = {
    findById: vi.fn(),
    findByBoardId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateOrder: vi.fn(),
    reorderColumns: vi.fn(),
    delete: vi.fn(),
  } as any;
  const mockActivityRepo = { createActivityLog: vi.fn() } as any;
  let service: ColumnServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ColumnServiceImpl(mockColumnRepo, mockActivityRepo);
  });

  it('validates width on create', async () => {
    await expect(service.createColumn({ title: 'T', width: 100, boardId: 'b1' } as any)).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws on moving to negative order', async () => {
    mockColumnRepo.findById.mockResolvedValueOnce({ id: 'col1', order: 0, cards: [] });
    await expect(service.moveColumn('col1', -2)).rejects.toBeInstanceOf(ValidationError);
  });

  it('reorderColumns validates unique orders', async () => {
    await expect(service.reorderColumns('b1', [ { id: 'a', order: 0 }, { id: 'b', order: 0 } ])).rejects.toBeInstanceOf(ValidationError);
  });

  it('deleteColumn fails if cards present', async () => {
    mockColumnRepo.findById.mockResolvedValueOnce({ id: 'col1', cards: [{}] });
    await expect(service.deleteColumn('col1')).rejects.toBeInstanceOf(ValidationError);
  });
});


