import type { Column } from '~/types';
import { columnRepository } from '~/lib/repositories/column-repository';
import { activityRepository } from '~/lib/repositories/activity-repository';
import { NotFoundError, ValidationError } from '~/lib/errors/domain-errors';

export interface ColumnService {
  getColumnById(columnId: string): Promise<Column | null>;
  getColumnsByBoardId(boardId: string): Promise<Column[]>;
  createColumn(data: {
    title: string;
    width: number;
    boardId: string;
    order?: number;
  }, userId?: string): Promise<Column>;
  updateColumn(columnId: string, updates: {
    title?: string;
    width?: number;
  }, userId?: string): Promise<Column>;
  moveColumn(columnId: string, newOrder: number, userId?: string): Promise<Column>;
  reorderColumns(boardId: string, columnOrders: { id: string; order: number }[], userId?: string): Promise<Column[]>;
  deleteColumn(columnId: string, userId?: string): Promise<void>;
}

export class ColumnServiceImpl implements ColumnService {
  constructor(
    private columnRepo = columnRepository,
    private activityRepo = activityRepository
  ) {}

  async getColumnById(columnId: string): Promise<Column | null> {
    return this.columnRepo.findById(columnId);
  }

  async getColumnsByBoardId(boardId: string): Promise<Column[]> {
    return this.columnRepo.findByBoardId(boardId);
  }

  async createColumn(data: {
    title: string;
    width: number;
    boardId: string;
    order?: number;
  }, userId?: string): Promise<Column> {
    // Business validation
    this.validateColumnTitle(data.title);
    this.validateColumnWidth(data.width);

    const column = await this.columnRepo.create(data);

    // Log activity for first card in the column if one exists
    if (userId && column.cards.length > 0) {
      await this.activityRepo.createActivityLog({
        actionType: 'CREATE_COLUMN',
        details: { title: column.title },
        cardId: column.cards[0].id, // Use first card for activity logging
        userId
      });
    }

    return column;
  }

  async updateColumn(columnId: string, updates: {
    title?: string;
    width?: number;
  }, userId?: string): Promise<Column> {
    const existingColumn = await this.columnRepo.findById(columnId);
    if (!existingColumn) {
      throw new NotFoundError('Column', columnId);
    }

    // Business validation
    if (updates.title !== undefined) {
      this.validateColumnTitle(updates.title);
    }

    if (updates.width !== undefined) {
      this.validateColumnWidth(updates.width);
    }

    const updatedColumn = await this.columnRepo.update(columnId, updates);

    // Log activity for significant changes if there are cards in the column
    if (userId && updatedColumn.cards.length > 0) {
      const activityPromises: Promise<unknown>[] = [];

      if (updates.title && updates.title !== existingColumn.title) {
        // Log activity for all cards in the column
        for (const card of updatedColumn.cards) {
          activityPromises.push(
            this.activityRepo.createActivityLog({
              actionType: 'UPDATE_COLUMN_TITLE',
              details: { oldTitle: existingColumn.title, newTitle: updates.title },
              cardId: card.id,
              userId
            })
          );
        }
      }

      await Promise.all(activityPromises);
    }

    return updatedColumn;
  }

  async moveColumn(columnId: string, newOrder: number, userId?: string): Promise<Column> {
    const existingColumn = await this.columnRepo.findById(columnId);
    if (!existingColumn) {
      throw new NotFoundError('Column', columnId);
    }

    if (newOrder < 0) {
      throw new ValidationError('Column order cannot be negative');
    }

    const updatedColumn = await this.columnRepo.updateOrder(columnId, newOrder);

    // Log activity if there are cards in the column
    if (userId && updatedColumn.cards.length > 0 && existingColumn.order !== newOrder) {
      for (const card of updatedColumn.cards) {
        await this.activityRepo.createActivityLog({
          actionType: 'MOVE_COLUMN',
          details: { 
            columnTitle: updatedColumn.title,
            oldOrder: existingColumn.order, 
            newOrder 
          },
          cardId: card.id,
          userId
        });
      }
    }

    return updatedColumn;
  }

  async reorderColumns(boardId: string, columnOrders: { id: string; order: number }[], userId?: string): Promise<Column[]> {
    // Business validation
    for (const { order } of columnOrders) {
      if (order < 0) {
        throw new ValidationError('Column order cannot be negative');
      }
    }

    // Check for duplicate orders
    const orders = columnOrders.map(co => co.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      throw new ValidationError('Column orders must be unique');
    }

    const updatedColumns = await this.columnRepo.reorderColumns(boardId, columnOrders);

    // Log activity for affected columns with cards
    if (userId) {
      const activityPromises: Promise<unknown>[] = [];

      for (const column of updatedColumns) {
        if (column.cards.length > 0) {
          for (const card of column.cards) {
            activityPromises.push(
              this.activityRepo.createActivityLog({
                actionType: 'REORDER_COLUMNS',
                details: { columnTitle: column.title, newOrder: column.order },
                cardId: card.id,
                userId
              })
            );
          }
        }
      }

      await Promise.all(activityPromises);
    }

    return updatedColumns;
  }

  async deleteColumn(columnId: string, userId?: string): Promise<void> {
    const existingColumn = await this.columnRepo.findById(columnId);
    if (!existingColumn) {
      throw new NotFoundError('Column', columnId);
    }

    // Business rule: Cannot delete column with cards
    if (existingColumn.cards.length > 0) {
      throw new ValidationError('Cannot delete column that contains cards. Move cards first.');
    }

    // Log activity before deletion (using a dummy card id since column has no cards)
    if (userId) {
      // Note: This is a limitation - we need at least one card to log activity
      // In a real system, you might want a separate board activity log
    }

    await this.columnRepo.delete(columnId);
  }

  private validateColumnTitle(title: string): void {
    if (!title || !title.trim()) {
      throw new ValidationError('Column title cannot be empty');
    }

    if (title.length > 100) {
      throw new ValidationError('Column title cannot exceed 100 characters');
    }
  }

  private validateColumnWidth(width: number): void {
    if (width < 200) {
      throw new ValidationError('Column width cannot be less than 200 pixels');
    }

    if (width > 1000) {
      throw new ValidationError('Column width cannot exceed 1000 pixels');
    }
  }
}

// Export singleton instance
export const columnService: ColumnService = new ColumnServiceImpl(); 