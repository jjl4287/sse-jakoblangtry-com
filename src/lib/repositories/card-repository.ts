import prisma from '~/lib/prisma';
import type { Card, Comment, Attachment, Label, User } from '~/types';
import type { BaseRepository } from './base-repository';
import type { Prisma } from '@prisma/client';

type CardWithRelations = Prisma.CardGetPayload<{
  include: {
    labels: true;
    attachments: true;
    comments: { include: { user: true } };
    assignees: true;
    board: true;
  }
}>;

export interface CardRepository extends BaseRepository<Card> {
  findByColumnId(columnId: string): Promise<Card[]>;
  findCardWithDetails(cardId: string): Promise<Card | null>;
  updateLabels(cardId: string, labelIdsToAdd: string[], labelIdsToRemove: string[]): Promise<Card>;
  updateAssignees(cardId: string, assigneeIdsToAdd: string[], assigneeIdsToRemove: string[]): Promise<Card>;
  moveCard(cardId: string, targetColumnId: string, newOrder: number): Promise<Card>;
  duplicateCard(cardId: string, targetColumnId?: string): Promise<Card>;
}

class PrismaCardRepository implements CardRepository {
  private mapToCard(prismaCard: CardWithRelations): Card {
    return {
      id: prismaCard.id,
      title: prismaCard.title,
      description: prismaCard.description,
      columnId: prismaCard.columnId,
      boardId: prismaCard.boardId,
      order: prismaCard.order,
      priority: prismaCard.priority as 'low' | 'medium' | 'high',
      weight: prismaCard.weight ?? undefined,
      dueDate: prismaCard.dueDate ?? undefined,
      labels: prismaCard.labels.map(l => ({
        id: l.id,
        name: l.name,
        color: l.color,
        boardId: l.boardId
      })),
      assignees: prismaCard.assignees.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image
      })),
      attachments: prismaCard.attachments.map(a => ({
        id: a.id,
        name: a.name,
        url: a.url,
        type: a.type,
        createdAt: a.createdAt
      })),
      comments: prismaCard.comments.map(c => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        cardId: c.cardId,
        userId: c.userId,
        user: {
          id: c.user.id,
          name: c.user.name,
          email: c.user.email,
          image: c.user.image,
        }
      }))
    };
  }

  async findById(id: string): Promise<Card | null> {
    const card = await prisma.card.findUnique({
      where: { id },
      include: {
        labels: true,
        attachments: true,
        comments: { include: { user: true } },
        assignees: true,
        board: true
      }
    });

    return card ? this.mapToCard(card) : null;
  }

  async findMany(): Promise<Card[]> {
    const cards = await prisma.card.findMany({
      include: {
        labels: true,
        attachments: true,
        comments: { include: { user: true } },
        assignees: true,
        board: true
      },
      orderBy: { order: 'asc' }
    });

    return cards.map(this.mapToCard);
  }

  async findByColumnId(columnId: string): Promise<Card[]> {
    const cards = await prisma.card.findMany({
      where: { columnId },
      include: {
        labels: true,
        attachments: true,
        comments: { include: { user: true } },
        assignees: true,
        board: true
      },
      orderBy: { order: 'asc' }
    });

    return cards.map(this.mapToCard);
  }

  async findCardWithDetails(cardId: string): Promise<Card | null> {
    // Same as findById for now, but could include additional relations
    return this.findById(cardId);
  }

  async create(data: {
    title: string;
    description?: string;
    columnId: string;
    boardId: string;
    priority?: 'low' | 'medium' | 'high';
    weight?: number;
    dueDate?: Date;
    labelIds?: string[];
    assigneeIds?: string[];
  }): Promise<Card> {
    const { labelIds = [], assigneeIds = [], ...cardData } = data;

    // Ensure boardId is set; infer from column if missing or empty
    let boardIdToUse = cardData.boardId;
    if (!boardIdToUse || boardIdToUse.trim() === '') {
      const column = await prisma.column.findUnique({
        where: { id: cardData.columnId },
        select: { boardId: true },
      });
      if (!column) {
        throw new Error('Column not found');
      }
      boardIdToUse = column.boardId;
    }

    // Compute next order in column
    const maxOrder = await prisma.card.findFirst({
      where: { columnId: cardData.columnId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = maxOrder ? maxOrder.order + 1 : 0;

    const card = await prisma.card.create({
      data: {
        ...cardData,
        boardId: boardIdToUse,
        description: cardData.description || '',
        priority: cardData.priority || 'medium',
        order: nextOrder,
        labels: labelIds.length > 0 ? { connect: labelIds.map(id => ({ id })) } : undefined,
        assignees: assigneeIds.length > 0 ? { connect: assigneeIds.map(id => ({ id })) } : undefined,
      },
      include: {
        labels: true,
        attachments: true,
        comments: { include: { user: true } },
        assignees: true,
        board: true
      }
    });

    return this.mapToCard(card);
  }

  async update(id: string, data: Partial<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    weight: number;
    dueDate: Date;
  }>): Promise<Card> {
    const card = await prisma.card.update({
      where: { id },
      data,
      include: {
        labels: true,
        attachments: true,
        comments: { include: { user: true } },
        assignees: true,
        board: true
      }
    });

    return this.mapToCard(card);
  }

  async updateLabels(cardId: string, labelIdsToAdd: string[], labelIdsToRemove: string[]): Promise<Card> {
    const card = await prisma.card.update({
      where: { id: cardId },
      data: {
        labels: {
          connect: labelIdsToAdd.map(id => ({ id })),
          disconnect: labelIdsToRemove.map(id => ({ id }))
        }
      },
      include: {
        labels: true,
        attachments: true,
        comments: { include: { user: true } },
        assignees: true,
        board: true
      }
    });

    return this.mapToCard(card);
  }

  async updateAssignees(cardId: string, assigneeIdsToAdd: string[], assigneeIdsToRemove: string[]): Promise<Card> {
    const card = await prisma.card.update({
      where: { id: cardId },
      data: {
        assignees: {
          connect: assigneeIdsToAdd.map(id => ({ id })),
          disconnect: assigneeIdsToRemove.map(id => ({ id }))
        }
      },
      include: {
        labels: true,
        attachments: true,
        comments: { include: { user: true } },
        assignees: true,
        board: true
      }
    });

    return this.mapToCard(card);
  }

  async moveCard(cardId: string, targetColumnId: string, newOrder: number): Promise<Card> {
    const card = await prisma.card.update({
      where: { id: cardId },
      data: {
        columnId: targetColumnId,
        order: newOrder
      },
      include: {
        labels: true,
        attachments: true,
        comments: { include: { user: true } },
        assignees: true,
        board: true
      }
    });

    return this.mapToCard(card);
  }

  async duplicateCard(cardId: string, targetColumnId?: string): Promise<Card> {
    const originalCard = await prisma.card.findUnique({
      where: { id: cardId },
      include: {
        labels: true,
        assignees: true,
        board: true
      }
    });

    if (!originalCard) {
      throw new Error('Card not found');
    }

    const newCard = await prisma.card.create({
      data: {
        title: `${originalCard.title} (Copy)`,
        description: originalCard.description,
        columnId: targetColumnId || originalCard.columnId,
        boardId: originalCard.boardId,
        priority: originalCard.priority,
        weight: originalCard.weight,
        dueDate: originalCard.dueDate,
        order: 0, // Will be recalculated
        labels: { connect: originalCard.labels.map(l => ({ id: l.id })) },
        assignees: { connect: originalCard.assignees.map(a => ({ id: a.id })) }
      },
      include: {
        labels: true,
        attachments: true,
        comments: { include: { user: true } },
        assignees: true,
        board: true
      }
    });

    return this.mapToCard(newCard);
  }

  async delete(id: string): Promise<void> {
    await prisma.card.delete({ where: { id } });
  }
}

export const cardRepository: CardRepository = new PrismaCardRepository(); 