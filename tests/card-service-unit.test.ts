import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CardServiceImpl } from '~/lib/services/card-service';
import { NotFoundError, ValidationError, BusinessRuleViolationError } from '~/lib/errors/domain-errors';

describe('CardService', () => {
  const mockCardRepo = {
    findById: vi.fn(),
    findByColumnId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateLabels: vi.fn(),
    updateAssignees: vi.fn(),
    moveCard: vi.fn(),
    duplicateCard: vi.fn(),
    delete: vi.fn(),
  } as any;

  const mockActivityRepo = { createActivityLog: vi.fn() } as any;
  let service: CardServiceImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CardServiceImpl(mockCardRepo, mockActivityRepo);
  });

  it('validates title on create', async () => {
    await expect(service.createCard({ title: '   ', columnId: 'c1', boardId: 'b1' } as any)).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates labels with business rule validation', async () => {
    mockCardRepo.findById.mockResolvedValueOnce({ id: 'card1' });
    await expect(service.updateCardLabels('card1', ['l1'], ['l1'])).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it('throws NotFound when updating missing card', async () => {
    mockCardRepo.findById.mockResolvedValueOnce(null);
    await expect(service.updateCard('missing', { title: 'X' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('moves card validates non-negative order', async () => {
    mockCardRepo.findById.mockResolvedValueOnce({ id: 'card1' });
    await expect(service.moveCard('card1', 'c2', -1)).rejects.toBeInstanceOf(ValidationError);
  });
});


