import prisma from '~/lib/prisma';
import type { Column } from '~/types';
import type { BaseRepository } from './base-repository';
import type { Prisma } from '@prisma/client';

type ColumnWithRelations = Prisma.ColumnGetPayload<{
  include: {
    cards: {
      include: {
        labels: true;
        attachments: true;
        comments: { include: { user: true } };
        assignees: true;
      }
    }
  }
}>;

export interface ColumnRepository extends BaseRepository<Column> {
  findByBoardId(boardId: string): Promise<Column[]>;
  findColumnWithCards(columnId: string): Promise<Column | null>;
  updateOrder(columnId: string, newOrder: number): Promise<Column>;
  reorderColumns(boardId: string, columnOrders: { id: string; order: number }[]): Promise<Column[]>;
}

class PrismaColumnRepository implements ColumnRepository {
  private mapToColumn(prismaColumn: ColumnWithRelations): Column {
    return {
      id: prismaColumn.id,
      title: prismaColumn.title,
      width: prismaColumn.width,
      order: prismaColumn.order,
      cards: prismaColumn.cards
        .sort((a, b) => a.order - b.order)
        .map(card => ({
          id: card.id,
          title: card.title,
          description: card.description,
          columnId: prismaColumn.id,
          order: card.order,
          priority: card.priority as 'low' | 'medium' | 'high',
          weight: card.weight ?? undefined,
          dueDate: card.dueDate ?? undefined,
          labels: card.labels.map(l => ({
            id: l.id,
            name: l.name,
            color: l.color,
            boardId: l.boardId
          })),
          assignees: card.assignees.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            image: u.image
          })),
          attachments: card.attachments.map(a => ({
            id: a.id,
            name: a.name,
            url: a.url,
            type: a.type,
            createdAt: a.createdAt
          })),
          comments: card.comments.map(c => ({
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
        }))
    };
  }

  async findById(id: string): Promise<Column | null> {
    const column = await prisma.column.findUnique({
      where: { id },
      include: {
        cards: {
          orderBy: { order: 'asc' },
          include: {
            labels: true,
            attachments: true,
            comments: { include: { user: true } },
            assignees: true
          }
        }
      }
    });

    return column ? this.mapToColumn(column) : null;
  }

  async findMany(): Promise<Column[]> {
    const columns = await prisma.column.findMany({
      include: {
        cards: {
          orderBy: { order: 'asc' },
          include: {
            labels: true,
            attachments: true,
            comments: { include: { user: true } },
            assignees: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    return columns.map(this.mapToColumn);
  }

  async findByBoardId(boardId: string): Promise<Column[]> {
    const columns = await prisma.column.findMany({
      where: { boardId: boardId }, // Using correct field name from Prisma schema
      include: {
        cards: {
          orderBy: { order: 'asc' },
          include: {
            labels: true,
            attachments: true,
            comments: { include: { user: true } },
            assignees: true
          }
        }
      },
      orderBy: { order: 'asc' }
    });

    return columns.map(this.mapToColumn);
  }

  async findColumnWithCards(columnId: string): Promise<Column | null> {
    // Same as findById for now, but explicit for clarity
    return this.findById(columnId);
  }

  async create(data: {
    title: string;
    width: number;
    boardId: string;
    order?: number;
  }): Promise<Column> {
    // Calculate next order if not provided
    const nextOrder = data.order ?? await this.getNextOrder(data.boardId);

    const column = await prisma.column.create({
      data: {
        title: data.title,
        width: data.width,
        boardId: data.boardId, // Using correct field name from Prisma schema
        order: nextOrder
      },
      include: {
        cards: {
          orderBy: { order: 'asc' },
          include: {
            labels: true,
            attachments: true,
            comments: { include: { user: true } },
            assignees: true
          }
        }
      }
    });

    return this.mapToColumn(column);
  }

  async update(id: string, data: Partial<{
    title: string;
    width: number;
  }>): Promise<Column> {
    const column = await prisma.column.update({
      where: { id },
      data,
      include: {
        cards: {
          orderBy: { order: 'asc' },
          include: {
            labels: true,
            attachments: true,
            comments: { include: { user: true } },
            assignees: true
          }
        }
      }
    });

    return this.mapToColumn(column);
  }

  async updateOrder(columnId: string, newOrder: number): Promise<Column> {
    const column = await prisma.column.update({
      where: { id: columnId },
      data: { order: newOrder },
      include: {
        cards: {
          orderBy: { order: 'asc' },
          include: {
            labels: true,
            attachments: true,
            comments: { include: { user: true } },
            assignees: true
          }
        }
      }
    });

    return this.mapToColumn(column);
  }

  async reorderColumns(boardId: string, columnOrders: { id: string; order: number }[]): Promise<Column[]> {
    // Use transaction to update all column orders atomically
    await prisma.$transaction(
      columnOrders.map(({ id, order }) =>
        prisma.column.update({
          where: { id },
          data: { order }
        })
      )
    );

    // Return updated columns
    return this.findByBoardId(boardId);
  }

  async delete(id: string): Promise<void> {
    await prisma.column.delete({ where: { id } });
  }

  private async getNextOrder(boardId: string): Promise<number> {
    const lastColumn = await prisma.column.findFirst({
      where: { boardId: boardId },
      orderBy: { order: 'desc' }
    });

    return (lastColumn?.order ?? -1) + 1;
  }
}

export const columnRepository: ColumnRepository = new PrismaColumnRepository(); 