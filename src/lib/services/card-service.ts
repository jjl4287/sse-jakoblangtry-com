import type { Card } from '~/types';
import { cardRepository } from '~/lib/repositories/card-repository';
import { activityRepository } from '~/lib/repositories/activity-repository';
import { NotFoundError, ValidationError, BusinessRuleViolationError } from '~/lib/errors/domain-errors';

export interface CardService {
  getCardById(cardId: string): Promise<Card | null>;
  getCardsByColumnId(columnId: string): Promise<Card[]>;
  createCard(data: {
    title: string;
    description?: string;
    columnId: string;
    boardId: string;
    priority?: 'low' | 'medium' | 'high';
    weight?: number;
    dueDate?: Date;
    labelIds?: string[];
    assigneeIds?: string[];
  }, userId?: string): Promise<Card>;
  updateCard(cardId: string, updates: {
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    weight?: number;
    dueDate?: Date;
  }, userId?: string): Promise<Card>;
  updateCardLabels(cardId: string, labelIdsToAdd: string[], labelIdsToRemove: string[], userId?: string): Promise<Card>;
  updateCardAssignees(cardId: string, assigneeIdsToAdd: string[], assigneeIdsToRemove: string[], userId?: string): Promise<Card>;
  moveCard(cardId: string, targetColumnId: string, newOrder: number, userId?: string): Promise<Card>;
  duplicateCard(cardId: string, targetColumnId?: string, userId?: string): Promise<Card>;
  deleteCard(cardId: string, userId?: string): Promise<void>;
}

export class CardServiceImpl implements CardService {
  constructor(
    private cardRepo = cardRepository,
    private activityRepo = activityRepository
  ) {}

  async getCardById(cardId: string): Promise<Card | null> {
    return this.cardRepo.findById(cardId);
  }

  async getCardsByColumnId(columnId: string): Promise<Card[]> {
    return this.cardRepo.findByColumnId(columnId);
  }

  async createCard(data: {
    title: string;
    description?: string;
    columnId: string;
    boardId: string;
    priority?: 'low' | 'medium' | 'high';
    weight?: number;
    dueDate?: Date;
    labelIds?: string[];
    assigneeIds?: string[];
  }, userId?: string): Promise<Card> {
    // Business validation
    this.validateCardTitle(data.title);
    
    if (data.weight !== undefined) {
      this.validateCardWeight(data.weight);
    }

    if (data.dueDate && data.dueDate < new Date()) {
      throw new ValidationError('Due date cannot be in the past');
    }

    const card = await this.cardRepo.create(data);

    // Log activity
    if (userId) {
      await this.activityRepo.createActivityLog({
        actionType: 'CREATE_CARD',
        details: { title: card.title },
        cardId: card.id,
        userId
      });
    }

    return card;
  }

  async updateCard(cardId: string, updates: {
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    weight?: number;
    dueDate?: Date;
  }, userId?: string): Promise<Card> {
    const existingCard = await this.cardRepo.findById(cardId);
    if (!existingCard) {
      throw new NotFoundError('Card', cardId);
    }

    // Business validation
    if (updates.title !== undefined) {
      this.validateCardTitle(updates.title);
    }

    if (updates.weight !== undefined) {
      this.validateCardWeight(updates.weight);
    }

    if (updates.dueDate && updates.dueDate < new Date()) {
      throw new ValidationError('Due date cannot be in the past');
    }

    const updatedCard = await this.cardRepo.update(cardId, updates);

    // Log activity for significant changes
    if (userId) {
      const activityPromises: Promise<any>[] = [];

      if (updates.title && updates.title !== existingCard.title) {
        activityPromises.push(
          this.activityRepo.createActivityLog({
            actionType: 'UPDATE_CARD_TITLE',
            details: { oldTitle: existingCard.title, newTitle: updates.title },
            cardId,
            userId
          })
        );
      }

      if (updates.priority && updates.priority !== existingCard.priority) {
        activityPromises.push(
          this.activityRepo.createActivityLog({
            actionType: 'UPDATE_CARD_PRIORITY',
            details: { oldPriority: existingCard.priority, newPriority: updates.priority },
            cardId,
            userId
          })
        );
      }

      if (updates.dueDate !== undefined && updates.dueDate !== existingCard.dueDate) {
        activityPromises.push(
          this.activityRepo.createActivityLog({
            actionType: 'UPDATE_CARD_DUE_DATE',
            details: { oldDueDate: existingCard.dueDate, newDueDate: updates.dueDate },
            cardId,
            userId
          })
        );
      }

      await Promise.all(activityPromises);
    }

    return updatedCard;
  }

  async updateCardLabels(cardId: string, labelIdsToAdd: string[], labelIdsToRemove: string[], userId?: string): Promise<Card> {
    const existingCard = await this.cardRepo.findById(cardId);
    if (!existingCard) {
      throw new NotFoundError('Card', cardId);
    }

    // Business rule: Cannot add and remove the same label
    const duplicateLabels = labelIdsToAdd.filter(id => labelIdsToRemove.includes(id));
    if (duplicateLabels.length > 0) {
      throw new BusinessRuleViolationError('Cannot add and remove the same label in one operation');
    }

    const updatedCard = await this.cardRepo.updateLabels(cardId, labelIdsToAdd, labelIdsToRemove);

    // Log activity
    if (userId) {
      const activityPromises: Promise<any>[] = [];

      if (labelIdsToAdd.length > 0) {
        activityPromises.push(
          this.activityRepo.createActivityLog({
            actionType: 'ADD_LABELS_TO_CARD',
            details: { labelIds: labelIdsToAdd },
            cardId,
            userId
          })
        );
      }

      if (labelIdsToRemove.length > 0) {
        activityPromises.push(
          this.activityRepo.createActivityLog({
            actionType: 'REMOVE_LABELS_FROM_CARD',
            details: { labelIds: labelIdsToRemove },
            cardId,
            userId
          })
        );
      }

      await Promise.all(activityPromises);
    }

    return updatedCard;
  }

  async updateCardAssignees(cardId: string, assigneeIdsToAdd: string[], assigneeIdsToRemove: string[], userId?: string): Promise<Card> {
    const existingCard = await this.cardRepo.findById(cardId);
    if (!existingCard) {
      throw new NotFoundError('Card', cardId);
    }

    // Business rule: Cannot add and remove the same assignee
    const duplicateAssignees = assigneeIdsToAdd.filter(id => assigneeIdsToRemove.includes(id));
    if (duplicateAssignees.length > 0) {
      throw new BusinessRuleViolationError('Cannot add and remove the same assignee in one operation');
    }

    const updatedCard = await this.cardRepo.updateAssignees(cardId, assigneeIdsToAdd, assigneeIdsToRemove);

    // Log activity
    if (userId) {
      const activityPromises: Promise<any>[] = [];

      if (assigneeIdsToAdd.length > 0) {
        activityPromises.push(
          this.activityRepo.createActivityLog({
            actionType: 'ADD_ASSIGNEES_TO_CARD',
            details: { assigneeIds: assigneeIdsToAdd },
            cardId,
            userId
          })
        );
      }

      if (assigneeIdsToRemove.length > 0) {
        activityPromises.push(
          this.activityRepo.createActivityLog({
            actionType: 'REMOVE_ASSIGNEES_FROM_CARD',
            details: { assigneeIds: assigneeIdsToRemove },
            cardId,
            userId
          })
        );
      }

      await Promise.all(activityPromises);
    }

    return updatedCard;
  }

  async moveCard(cardId: string, targetColumnId: string, newOrder: number, userId?: string): Promise<Card> {
    const existingCard = await this.cardRepo.findById(cardId);
    if (!existingCard) {
      throw new NotFoundError('Card', cardId);
    }

    if (newOrder < 0) {
      throw new ValidationError('Card order cannot be negative');
    }

    const updatedCard = await this.cardRepo.moveCard(cardId, targetColumnId, newOrder);

    // Log activity
    if (userId && existingCard.columnId !== targetColumnId) {
      await this.activityRepo.createActivityLog({
        actionType: 'MOVE_CARD',
        details: { 
          fromColumnId: existingCard.columnId, 
          toColumnId: targetColumnId,
          newOrder 
        },
        cardId,
        userId
      });
    }

    return updatedCard;
  }

  async duplicateCard(cardId: string, targetColumnId?: string, userId?: string): Promise<Card> {
    const existingCard = await this.cardRepo.findById(cardId);
    if (!existingCard) {
      throw new NotFoundError('Card', cardId);
    }

    const duplicatedCard = await this.cardRepo.duplicateCard(cardId, targetColumnId);

    // Log activity
    if (userId) {
      await this.activityRepo.createActivityLog({
        actionType: 'DUPLICATE_CARD',
        details: { 
          originalCardId: cardId,
          targetColumnId: targetColumnId || existingCard.columnId
        },
        cardId: duplicatedCard.id,
        userId
      });
    }

    return duplicatedCard;
  }

  async deleteCard(cardId: string, userId?: string): Promise<void> {
    const existingCard = await this.cardRepo.findById(cardId);
    if (!existingCard) {
      throw new NotFoundError('Card', cardId);
    }

    // Log activity before deletion
    if (userId) {
      await this.activityRepo.createActivityLog({
        actionType: 'DELETE_CARD',
        details: { title: existingCard.title },
        cardId,
        userId
      });
    }

    await this.cardRepo.delete(cardId);
  }

  private validateCardTitle(title: string): void {
    if (!title || !title.trim()) {
      throw new ValidationError('Card title cannot be empty');
    }

    if (title.length > 255) {
      throw new ValidationError('Card title cannot exceed 255 characters');
    }
  }

  private validateCardWeight(weight: number): void {
    if (weight < 0) {
      throw new ValidationError('Card weight cannot be negative');
    }

    if (weight > 1000) {
      throw new ValidationError('Card weight cannot exceed 1000');
    }
  }
}

// Export singleton instance
export const cardService: CardService = new CardServiceImpl(); 