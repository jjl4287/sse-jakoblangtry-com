import type { Label } from '~/types';
import { labelRepository } from '~/lib/repositories/label-repository';
import { NotFoundError, ValidationError } from '~/lib/errors/domain-errors';

export interface LabelService {
  getBoardLabels(boardId: string): Promise<Label[]>;
  createLabel(boardId: string, name: string, color: string): Promise<Label>;
  updateLabel(boardId: string, labelId: string, name: string, color: string): Promise<Label>;
  deleteLabel(boardId: string, labelId: string): Promise<void>;
}

export class LabelServiceImpl implements LabelService {
  constructor(private repo = labelRepository) {}

  async getBoardLabels(boardId: string): Promise<Label[]> {
    return this.repo.findByBoardId(boardId);
  }

  async createLabel(boardId: string, name: string, color: string): Promise<Label> {
    this.validateName(name);
    this.validateColor(color);
    return this.repo.create({ boardId, name: name.trim(), color });
  }

  async updateLabel(boardId: string, labelId: string, name: string, color: string): Promise<Label> {
    this.validateName(name);
    this.validateColor(color);
    const existing = await this.repo.findById(labelId);
    if (!existing || existing.boardId !== boardId) {
      throw new NotFoundError('Label', labelId);
    }
    return this.repo.update(labelId, { name: name.trim(), color });
  }

  async deleteLabel(boardId: string, labelId: string): Promise<void> {
    const existing = await this.repo.findById(labelId);
    if (!existing || existing.boardId !== boardId) {
      throw new NotFoundError('Label', labelId);
    }
    await this.repo.deleteFromBoard(boardId, labelId);
  }

  private validateName(name: string) {
    if (!name || !name.trim()) throw new ValidationError('Label name is required');
    if (name.length > 50) throw new ValidationError('Label name cannot exceed 50 characters');
  }

  private validateColor(color: string) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new ValidationError('Color must be a valid hex code');
    }
  }
}

export const labelService: LabelService = new LabelServiceImpl();


