/**
 * Type definitions for the kanban board application
 */

/**
 * Board interface representing the entire kanban board
 */
export interface Board {
  columns: Column[];
  theme: 'light' | 'dark';
}

/**
 * Column interface representing a kanban column
 */
export interface Column {
  id: string;
  title: string;
  width: number; // Percentage or pixel value
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
  assignees: string[];
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
  author: string;
  content: string;
  createdAt: Date;
} 