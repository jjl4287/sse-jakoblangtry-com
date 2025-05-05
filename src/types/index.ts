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
  user: User; // Assuming a Board belongs to a User (creator/owner)
  userId: string;
  boardMembers?: BoardMember[]; // Users who are members of the board
  boardGroups?: BoardGroup[]; // Groups the board is shared with
  pinned: boolean;
  isPublic: boolean;
  /** Flattened list of board members with user data */
  members?: { id: string; name: string; email?: string | null; joinedAt: string }[];
  /** Milestones associated with this board */
  milestones?: Milestone[];
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
  milestoneId?: string;
  /** Optional milestone associated with the card */
  milestone?: Milestone;
}

// Add Priority type alias for Card priority
export type Priority = Card['priority'];

/**
 * CardWithIncludes interface representing a card with all its relations loaded
 */
export type CardWithIncludes = Card & {
  labels: Label[];
  assignees: User[];
  attachments: Attachment[];
  comments: Comment[];
  milestone?: Milestone | null;
  column?: Column; // Optional: Include the column relationship if needed
};

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

/**
 * Milestone interface for card scheduling
 */
export interface Milestone {
  id: string;
  name: string;
  title: string;
  dueDate?: Date;
}

/**
 * User interface representing an application user
 */
export interface User {
  id: string;
  name: string;
  email?: string | null; // Allow null as per schema
  image?: string | null; // Allow null as per schema
  emailVerified?: Date | null; // Allow null as per schema
  hashedPassword?: string | null; // Allow null as per schema
  assignedCards?: Card[];
  boards?: Board[];
  boardMembers?: BoardMember[];
  groupMembers?: GroupMember[];
  accounts?: Account[]; // Assuming Account type exists elsewhere or is defined here
  sessions?: Session[]; // Assuming Session type exists elsewhere or is defined here
}

/**
 * BoardMember interface representing the relationship between a User and a Board
 */
export interface BoardMember {
  id: string;
  userId: string;
  boardId: string;
}

/**
 * Combined type for BoardMember including the full User object
 */
export interface BoardMemberWithUser extends BoardMember {
  user: User;
}

/**
 * Group interface for organization-level sharing
 */
export interface Group {
  id: string;
  name: string;
  members?: GroupMember[];
  boardGroups?: BoardGroup[];
}

/**
 * GroupMember interface representing the relationship between a User and a Group
 */
export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
}

/**
 * BoardGroup interface representing the relationship between a Board and a Group
 */
export interface BoardGroup {
  id: string;
  boardId: string;
  board: Board;
  groupId: string;
  group: Group;
}

// Minimal definitions for Account and Session if not defined elsewhere
// These might need more detail depending on your auth implementation
export interface Account {
  id: string;
  userId: string;
  // ... other NextAuth Account fields
}

export interface Session {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
  // ... other NextAuth Session fields
} 