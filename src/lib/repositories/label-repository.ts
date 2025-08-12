import prisma from '~/lib/prisma';
import type { Label } from '~/types';
import type { BaseRepository } from './base-repository';

export interface LabelRepository extends BaseRepository<Label> {
  findByBoardId(boardId: string): Promise<Label[]>;
  upsertForBoard(boardId: string, label: { id?: string; name: string; color: string }): Promise<Label>;
  deleteFromBoard(boardId: string, labelId: string): Promise<void>;
}

class PrismaLabelRepository implements LabelRepository {
  async findById(id: string): Promise<Label | null> {
    const label = await prisma.label.findUnique({ where: { id } });
    return label ? { id: label.id, name: label.name, color: label.color, boardId: label.boardId } : null;
  }

  async findMany(): Promise<Label[]> {
    const labels = await prisma.label.findMany();
    return labels.map(l => ({ id: l.id, name: l.name, color: l.color, boardId: l.boardId }));
  }

  async findByBoardId(boardId: string): Promise<Label[]> {
    const labels = await prisma.label.findMany({ where: { boardId }, orderBy: { name: 'asc' } });
    return labels.map(l => ({ id: l.id, name: l.name, color: l.color, boardId: l.boardId }));
  }

  async create(data: { name: string; color: string; boardId: string }): Promise<Label> {
    const label = await prisma.label.create({ data });
    return { id: label.id, name: label.name, color: label.color, boardId: label.boardId };
  }

  async upsertForBoard(boardId: string, label: { id?: string; name: string; color: string }): Promise<Label> {
    if (label.id) {
      const updated = await prisma.label.update({ where: { id: label.id }, data: { name: label.name, color: label.color } });
      return { id: updated.id, name: updated.name, color: updated.color, boardId: updated.boardId };
    }
    return this.create({ name: label.name, color: label.color, boardId });
  }

  async update(id: string, data: Partial<{ name: string; color: string }>): Promise<Label> {
    const updated = await prisma.label.update({ where: { id }, data });
    return { id: updated.id, name: updated.name, color: updated.color, boardId: updated.boardId };
  }

  async delete(id: string): Promise<void> {
    await prisma.label.delete({ where: { id } });
  }

  async deleteFromBoard(boardId: string, labelId: string): Promise<void> {
    await prisma.label.deleteMany({ where: { id: labelId, boardId } });
  }
}

export const labelRepository: LabelRepository = new PrismaLabelRepository();


