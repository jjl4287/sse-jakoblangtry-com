/**
 * Type definitions for the kanban board application
 */

/**
 * Update types for mutations
 */
export interface CardUpdate {
  title?: string;
  description?: string;
  dueDate?: Date | null;
  priority?: 'low' | 'medium' | 'high';
  weight?: number | null;
  labelIdsToAdd?: string[];
  labelIdsToRemove?: string[];
  assigneeIdsToAdd?: string[];
  assigneeIdsToRemove?: string[];
}

export interface ColumnUpdate {
  title?: string;
  width?: number;
  order?: number;
}

export interface BoardUpdate {
  title?: string;
  theme?: 'light' | 'dark';
}

export interface CardCreateData {
  title: string;
  description?: string;
  columnId: string;
  order: number;
  priority?: 'low' | 'medium' | 'high';
  weight?: number;
  labelIds?: string[];
  assigneeIds?: string[];
}

export interface ColumnCreateData {
  title: string;
  width?: number;
  order: number;
}

/**
 * Activity Log Details Types
 */
export interface LabelActivityDetails {
  labelId: string;
  labelName: string;
  labelColor: string;
}

export interface AssigneeActivityDetails {
  userId: string;
  userName: string;
  userEmail?: string;
}

export interface MoveActivityDetails {
  fromColumnId: string;
  fromColumnTitle: string;
  toColumnId: string;
  toColumnTitle: string;
  newOrder: number;
}

export interface UpdateActivityDetails {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface CreateActivityDetails {
  entityType: 'card' | 'column' | 'comment';
  entityId: string;
  entityTitle?: string;
}

export interface DeleteActivityDetails {
  entityType: 'card' | 'column' | 'comment' | 'attachment';
  entityId: string;
  entityTitle?: string;
}

export interface CommentActivityDetails {
  commentId: string;
  content: string;
}

export interface AttachmentActivityDetails {
  attachmentId: string;
  attachmentName: string;
  attachmentType: string;
}

export type ActivityDetails = 
  | LabelActivityDetails
  | AssigneeActivityDetails
  | MoveActivityDetails
  | UpdateActivityDetails
  | CreateActivityDetails
  | DeleteActivityDetails
  | CommentActivityDetails
  | AttachmentActivityDetails;

/**
 * Board interface representing the entire kanban board
 */
export interface Board {
  id: string;
  title: string;
  columns: Column[];
  theme: 'light' | 'dark';
  labels: Label[];
  members: BoardMembership[];
}

/**
 * Column interface representing a kanban column
 */
export interface Column {
  id: string;
  title: string;
  width: number; // Percentage or pixel value
  order: number; // Position of column in board
  cards: Card[];
}

/**
 * Card interface representing a task card
 */
export interface Card {
  id: string;
  title: string;
  description: string;
  labels: Label[];
  dueDate?: Date;
  assignees: User[];
  priority: 'low' | 'medium' | 'high';
  weight?: number; // Added field for card weight
  attachments: Attachment[];
  comments: Comment[];
  columnId: string;
  order: number; // Position within the column
  boardId: string;
}

// Add Priority type alias for Card priority
export type Priority = Card['priority'];

/**
 * Label interface for card categorization
 */
export interface Label {
  id: string;
  name: string;
  color: string;
  boardId: string;
}

/**
 * Attachment interface for files linked to cards
 */
export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string; // MIME type or category
  createdAt: Date;
}

/**
 * Comment interface for discussions on cards
 */
export interface Comment {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  cardId: string;
  userId: string;
  user: User;
}

/**
 * Simplified User interface for relations like assignees and board members
 */
export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * BoardMembership interface linking Users to Boards with roles
 */
export interface BoardMembership {
  id: string;
  role: string;
  user: User;
  userId: string;
  boardId: string;
}

/**
 * ActivityLog interface for tracking changes
 */
export interface ActivityLog {
  id: string;
  actionType: string; // e.g., "CREATE_CARD", "ADD_LABEL_TO_CARD"
  details?: ActivityDetails; // Now properly typed instead of any
  createdAt: Date;
  cardId: string;
  userId?: string | null; // Optional: action might be by system or user might be deleted
  user?: User | null; // User who performed the action, matches API response
} 