/**
 * Type definitions for the kanban board application
 */

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
  attachments: Attachment[];
  comments: Comment[];
  columnId: string;
  order: number; // Position within the column
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
  details?: any; // Prisma Json can be any serializable type
  createdAt: Date;
  cardId: string;
  userId?: string | null; // Optional: action might be by system or user might be deleted
  user?: User | null; // User who performed the action, matches API response
} 