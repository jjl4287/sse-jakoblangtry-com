import type { ActivityLog } from '~/types';
import { activityRepository } from '~/lib/repositories/activity-repository';
import { NotFoundError, ValidationError } from '~/lib/errors/domain-errors';

export interface ActivityService {
  getActivityById(activityId: string): Promise<ActivityLog | null>;
  getActivityByCardId(cardId: string): Promise<ActivityLog[]>;
  logActivity(data: {
    actionType: string;
    details?: any;
    cardId: string;
    userId?: string;
  }): Promise<ActivityLog>;
  deleteActivity(activityId: string): Promise<void>;
  clearCardActivity(cardId: string): Promise<void>;
}

export class ActivityServiceImpl implements ActivityService {
  private static readonly VALID_ACTION_TYPES = [
    // Card actions
    'CREATE_CARD',
    'UPDATE_CARD_TITLE',
    'UPDATE_CARD_DESCRIPTION',
    'UPDATE_CARD_PRIORITY',
    'UPDATE_CARD_DUE_DATE',
    'UPDATE_CARD_WEIGHT',
    'MOVE_CARD',
    'DUPLICATE_CARD',
    'DELETE_CARD',
    
    // Label actions
    'ADD_LABELS_TO_CARD',
    'REMOVE_LABELS_FROM_CARD',
    'CREATE_LABEL',
    'UPDATE_LABEL',
    'DELETE_LABEL',
    
    // Assignee actions
    'ADD_ASSIGNEES_TO_CARD',
    'REMOVE_ASSIGNEES_FROM_CARD',
    
    // Comment actions
    'ADD_COMMENT',
    'UPDATE_COMMENT',
    'DELETE_COMMENT',
    
    // Attachment actions
    'ADD_ATTACHMENT',
    'DELETE_ATTACHMENT',
    
    // Column actions
    'CREATE_COLUMN',
    'UPDATE_COLUMN_TITLE',
    'MOVE_COLUMN',
    'REORDER_COLUMNS',
    'DELETE_COLUMN',
    
    // Board actions
    'CREATE_BOARD',
    'UPDATE_BOARD_TITLE',
    'UPDATE_BOARD_THEME',
    'SHARE_BOARD',
    'UNSHARE_BOARD',
    'DELETE_BOARD'
  ];

  constructor(
    private activityRepo = activityRepository
  ) {}

  async getActivityById(activityId: string): Promise<ActivityLog | null> {
    return this.activityRepo.findById(activityId);
  }

  async getActivityByCardId(cardId: string): Promise<ActivityLog[]> {
    return this.activityRepo.findByCardId(cardId);
  }

  async logActivity(data: {
    actionType: string;
    details?: any;
    cardId: string;
    userId?: string;
  }): Promise<ActivityLog> {
    // Business validation
    this.validateActivityData(data);

    return this.activityRepo.createActivityLog(data);
  }

  async deleteActivity(activityId: string): Promise<void> {
    const existingActivity = await this.activityRepo.findById(activityId);
    if (!existingActivity) {
      throw new NotFoundError('Activity', activityId);
    }

    await this.activityRepo.delete(activityId);
  }

  async clearCardActivity(cardId: string): Promise<void> {
    await this.activityRepo.deleteByCardId(cardId);
  }

  private validateActivityData(data: {
    actionType: string;
    details?: any;
    cardId: string;
    userId?: string;
  }): void {
    // Validate action type
    if (!data.actionType || !data.actionType.trim()) {
      throw new ValidationError('Action type cannot be empty');
    }

    if (!ActivityServiceImpl.VALID_ACTION_TYPES.includes(data.actionType)) {
      throw new ValidationError(`Invalid action type: ${data.actionType}`);
    }

    // Validate card ID
    if (!data.cardId || !data.cardId.trim()) {
      throw new ValidationError('Card ID cannot be empty');
    }

    // Validate details if provided
    if (data.details !== undefined && data.details !== null) {
      this.validateActivityDetails(data.details);
    }
  }

  private validateActivityDetails(details: any): void {
    // Check if details can be serialized to JSON
    try {
      JSON.stringify(details);
    } catch {
      throw new ValidationError('Activity details must be JSON serializable');
    }

    // Check size limit (Prisma JSON fields have practical limits)
    const serialized = JSON.stringify(details);
    if (serialized.length > 65535) { // ~64KB limit
      throw new ValidationError('Activity details are too large');
    }
  }

  /**
   * Helper method to format activity messages for display
   */
  formatActivityMessage(activity: ActivityLog): string {
    const userName = activity.user?.name || 'Someone';
    
    switch (activity.actionType) {
      case 'CREATE_CARD':
        return `${userName} created this card`;
        
      case 'UPDATE_CARD_TITLE':
        const { oldTitle, newTitle } = activity.details || {};
        return `${userName} changed the title from "${oldTitle}" to "${newTitle}"`;
        
      case 'UPDATE_CARD_PRIORITY':
        const { oldPriority, newPriority } = activity.details || {};
        return `${userName} changed priority from ${oldPriority} to ${newPriority}`;
        
      case 'MOVE_CARD':
        return `${userName} moved this card`;
        
      case 'ADD_LABELS_TO_CARD':
        const labelCount = activity.details?.labelIds?.length || 0;
        return `${userName} added ${labelCount} label${labelCount === 1 ? '' : 's'}`;
        
      case 'REMOVE_LABELS_FROM_CARD':
        const removedLabelCount = activity.details?.labelIds?.length || 0;
        return `${userName} removed ${removedLabelCount} label${removedLabelCount === 1 ? '' : 's'}`;
        
      case 'ADD_ASSIGNEES_TO_CARD':
        const assigneeCount = activity.details?.assigneeIds?.length || 0;
        return `${userName} added ${assigneeCount} assignee${assigneeCount === 1 ? '' : 's'}`;
        
      case 'REMOVE_ASSIGNEES_FROM_CARD':
        const removedAssigneeCount = activity.details?.assigneeIds?.length || 0;
        return `${userName} removed ${removedAssigneeCount} assignee${removedAssigneeCount === 1 ? '' : 's'}`;
        
      case 'ADD_COMMENT':
        return `${userName} added a comment`;
        
      case 'UPDATE_COMMENT':
        return `${userName} updated a comment`;
        
      case 'DELETE_COMMENT':
        return `${userName} deleted a comment`;
        
      case 'ADD_ATTACHMENT':
        const attachmentName = activity.details?.name || 'an attachment';
        return `${userName} added ${attachmentName}`;
        
      case 'DELETE_ATTACHMENT':
        const deletedAttachmentName = activity.details?.name || 'an attachment';
        return `${userName} removed ${deletedAttachmentName}`;
        
      case 'DUPLICATE_CARD':
        return `${userName} duplicated this card`;
        
      case 'DELETE_CARD':
        return `${userName} deleted this card`;
        
      default:
        return `${userName} performed an action (${activity.actionType})`;
    }
  }
}

// Export singleton instance
export const activityService: ActivityService = new ActivityServiceImpl(); 