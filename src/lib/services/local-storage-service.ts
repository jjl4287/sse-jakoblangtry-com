import type { Board } from '~/types';

const LOCAL_BOARDS_KEY = 'sse_local_boards';
const LOCAL_BOARDS_VERSION = '2.0';

export interface LocalLabel {
  id: string;
  name: string;
  color: string;
}

export interface LocalAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  url: string;
}

export interface LocalCard {
  id: string;
  title: string;
  description: string;
  order: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  weight?: number;
  columnId: string;
  labels?: LocalLabel[];
  attachments?: LocalAttachment[];
}

export interface LocalColumn {
  id: string;
  title: string;
  order: number;
  width: number;
  cards: LocalCard[];
}

export interface LocalBoard {
  id: string;
  title: string;
  pinned: boolean;
  columns: LocalColumn[];
  createdAt: string;
  updatedAt: string;
  version: string;
  labels?: LocalLabel[];
}

class LocalStorageService {
  private readonly STORAGE_KEY = LOCAL_BOARDS_KEY;
  private readonly VERSION_KEY = 'sse_local_boards_version';
  private readonly CURRENT_VERSION = LOCAL_BOARDS_VERSION;
  private hasFixedBoardIds = false; // Prevent multiple fix attempts
  private hasCheckedVersion = false; // Avoid redundant migrations per session

  // Check if a board ID represents a local board
  isLocalBoard(boardId: string): boolean {
    if (!boardId) return false;
    
    // Run the board ID fix once per session
    if (!this.hasFixedBoardIds) {
      this.hasFixedBoardIds = true;
      this.fixBoardIds();
    }
    
    // Primary check: boards with local_ prefix
    if (boardId.startsWith('local_')) {
      return true;
    }
    
    // Fallback: check if the board exists in local storage 
    // (for boards that might have been created with incorrect IDs)
    try {
      const localBoards = this.getStoredBoards();
      return localBoards.some(board => board.id === boardId);
    } catch (error) {
      console.error('Error checking local boards:', error);
      return false;
    }
  }

  // Generate a new local board ID
  private generateLocalId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getStoredBoards(): LocalBoard[] {
    try {
      this.ensureVersionCompatibility();
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      
      // Filter out any invalid boards
      return parsed.filter(board => this.isValidLocalBoard(board));
    } catch (error) {
      console.error('Error reading local boards:', error);
      return [];
    }
  }

  private saveBoards(boards: LocalBoard[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(boards));
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
    } catch (error) {
      console.error('Error saving local boards:', error);
      throw new Error('Failed to save boards to local storage');
    }
  }

  private isValidLocalBoard(board: unknown): board is LocalBoard {
    return (
      typeof board === 'object' &&
      board !== null &&
      'id' in board &&
      'title' in board &&
      'columns' in board &&
      typeof board.id === 'string' &&
      typeof board.title === 'string' &&
      Array.isArray(board.columns)
    );
  }

  getLocalBoards(): LocalBoard[] {
    return this.getStoredBoards();
  }

  getLocalBoard(boardId: string): LocalBoard | null {
    const boards = this.getStoredBoards();
    return boards.find(board => board.id === boardId) || null;
  }

  createLocalBoard(title: string, id?: string): LocalBoard {
    const boardId = id || this.generateLocalId();
    const newBoard: LocalBoard = {
      id: boardId,
      title,
      pinned: false,
      columns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: this.CURRENT_VERSION,
      labels: [
        { id: `${boardId}_label_1`, name: 'Bug', color: '#ef4444' },
        { id: `${boardId}_label_2`, name: 'Feature', color: '#3b82f6' },
        { id: `${boardId}_label_3`, name: 'Enhancement', color: '#8b5cf6' },
        { id: `${boardId}_label_4`, name: 'Urgent', color: '#f59e0b' },
        { id: `${boardId}_label_5`, name: 'Low Priority', color: '#6b7280' }
      ]
    };

    const boards = this.getStoredBoards();
    boards.unshift(newBoard); // Add to beginning
    this.saveBoards(boards);
    return newBoard;
  }

  updateLocalBoard(boardId: string, updates: Partial<LocalBoard>): LocalBoard | null {
    const boards = this.getStoredBoards();
    const boardIndex = boards.findIndex(b => b.id === boardId);
    
    if (boardIndex === -1) {
      return null;
    }

    const updatedBoard = {
      ...boards[boardIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    boards[boardIndex] = updatedBoard;
    this.saveBoards(boards);
    return updatedBoard;
  }

  deleteLocalBoard(boardId: string): boolean {
    const boards = this.getStoredBoards();
    const filteredBoards = boards.filter(b => b.id !== boardId);
    
    if (filteredBoards.length === boards.length) {
      return false; // Board not found
    }

    this.saveBoards(filteredBoards);
    return true;
  }

  // Column operations
  createLocalColumn(boardId: string, data: { title: string; width?: number }): LocalColumn | null {
    const board = this.getLocalBoard(boardId);
    if (!board) return null;

    const newColumn: LocalColumn = {
      id: this.generateLocalId(),
      title: data.title,
      order: board.columns.length,
      width: data.width || 300,
      cards: []
    };

    board.columns.push(newColumn);
    this.updateLocalBoard(boardId, { columns: board.columns });

    return newColumn;
  }

  updateLocalColumn(boardId: string, columnId: string, updates: Partial<Omit<LocalColumn, 'id' | 'cards'>>): LocalColumn | null {
    const board = this.getLocalBoard(boardId);
    if (!board) return null;

    const columnIndex = board.columns.findIndex(col => col.id === columnId);
    if (columnIndex === -1) return null;

    board.columns[columnIndex] = {
      ...board.columns[columnIndex],
      ...updates
    };

    this.updateLocalBoard(boardId, { columns: board.columns });
    return board.columns[columnIndex];
  }

  deleteLocalColumn(boardId: string, columnId: string): boolean {
    const board = this.getLocalBoard(boardId);
    if (!board) return false;

    const filteredColumns = board.columns.filter(col => col.id !== columnId);
    if (filteredColumns.length === board.columns.length) {
      return false; // Column not found
    }

    this.updateLocalBoard(boardId, { columns: filteredColumns });
    return true;
  }

  // Card operations
  createLocalCard(boardId: string, columnId: string, data: { title: string; description?: string; priority?: LocalCard['priority']; dueDate?: string; weight?: number }): LocalCard | null {
    const board = this.getLocalBoard(boardId);
    if (!board) return null;

    const column = board.columns.find(col => col.id === columnId);
    if (!column) return null;

    const newCard: LocalCard = {
      id: this.generateLocalId(),
      title: data.title,
      description: data.description || '',
      order: column.cards.length,
      priority: data.priority || 'medium',
      dueDate: data.dueDate,
      weight: data.weight,
      columnId: columnId,
      labels: [],
      attachments: []
    };

    column.cards.push(newCard);
    this.updateLocalBoard(boardId, { columns: board.columns });

    return newCard;
  }

  updateLocalCard(boardId: string, cardId: string, updates: Partial<Omit<LocalCard, 'id' | 'columnId'>>): LocalCard | null {
    const board = this.getLocalBoard(boardId);
    if (!board) return null;

    for (const column of board.columns) {
      const cardIndex = column.cards.findIndex(card => card.id === cardId);
      if (cardIndex !== -1) {
        column.cards[cardIndex] = {
          ...column.cards[cardIndex],
          ...updates
        };
        this.updateLocalBoard(boardId, { columns: board.columns });
        return column.cards[cardIndex];
      }
    }

    return null;
  }

  moveLocalCard(boardId: string, cardId: string, targetColumnId: string, newOrder: number): boolean {
    const board = this.getLocalBoard(boardId);
    if (!board) return false;

    // Find the card in its current column
    let sourceColumn: LocalColumn | null = null;
    let cardToMove: LocalCard | null = null;

    for (const column of board.columns) {
      const cardIndex = column.cards.findIndex(card => card.id === cardId);
      if (cardIndex !== -1) {
        sourceColumn = column;
        cardToMove = column.cards.splice(cardIndex, 1)[0];
        break;
      }
    }

    if (!cardToMove || !sourceColumn) return false;

    // Find the target column
    const targetColumn = board.columns.find(col => col.id === targetColumnId);
    if (!targetColumn) {
      // If target column not found, put the card back
      sourceColumn.cards.push(cardToMove);
      return false;
    }

    // Update card's columnId and insert at new position
    cardToMove.columnId = targetColumnId;
    targetColumn.cards.splice(newOrder, 0, cardToMove);

    // Reorder cards in both columns
    sourceColumn.cards = sourceColumn.cards.map((card, index) => ({ ...card, order: index }));
    targetColumn.cards = targetColumn.cards.map((card, index) => ({ ...card, order: index }));

    this.updateLocalBoard(boardId, { columns: board.columns });
    return true;
  }

  deleteLocalCard(boardId: string, cardId: string): boolean {
    const board = this.getLocalBoard(boardId);
    if (!board) return false;

    for (const column of board.columns) {
      const cardIndex = column.cards.findIndex(card => card.id === cardId);
      if (cardIndex !== -1) {
        column.cards.splice(cardIndex, 1);
        // Reorder remaining cards
        column.cards = column.cards.map((card, index) => ({ ...card, order: index }));
        this.updateLocalBoard(boardId, { columns: board.columns });
        return true;
      }
    }

    return false;
  }

  // Migration helper: convert local board to API-compatible format
  convertLocalBoardForAPI(localBoard: LocalBoard): {
    board: Omit<LocalBoard, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
    columns: Array<Omit<LocalColumn, 'id' | 'cards'> & { cards: Array<Omit<LocalCard, 'id' | 'columnId'>> }>;
  } {
    return {
      board: {
        title: localBoard.title,
        pinned: localBoard.pinned,
        columns: []
      },
      columns: localBoard.columns.map(column => ({
        title: column.title,
        order: column.order,
        width: column.width,
        cards: column.cards.map(card => ({
          title: card.title,
          description: card.description,
          order: card.order,
          priority: card.priority,
          dueDate: card.dueDate,
          weight: card.weight,
          labels: card.labels,
          attachments: card.attachments
        }))
      }))
    };
  }

  // Convert local board to API Board format for consistent usage
  convertToApiBoard(localBoard: LocalBoard): Board {
    return {
      id: localBoard.id,
      title: localBoard.title,
      pinned: localBoard.pinned,
      theme: 'light' as const,
      isPublic: false,
      creatorId: 'local',
      createdAt: localBoard.createdAt,
      updatedAt: localBoard.updatedAt,
      columns: localBoard.columns.map(col => ({
        id: col.id,
        title: col.title,
        order: col.order,
        width: col.width,
        cards: col.cards.map(card => ({
          id: card.id,
          title: card.title,
          description: card.description,
          columnId: card.columnId,
          order: card.order,
          priority: card.priority,
          dueDate: card.dueDate,
          weight: card.weight,
          labels: card.labels?.map(label => ({
            id: label.id,
            name: label.name,
            color: label.color,
            boardId: localBoard.id
          })) || [],
          assignees: [], // Local boards don't support assignees yet
          attachments: card.attachments?.map(att => ({
            id: att.id,
            fileName: att.fileName,
            fileSize: att.fileSize,
            contentType: att.contentType,
            url: att.url
          })) || [],
          comments: [] // Local boards don't support comments yet
        }))
      })),
      members: [], // Local boards don't support members yet
      labels: localBoard.labels?.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        boardId: localBoard.id
      })) || []
    };
  }

  // Clear all local boards (used after successful migration)
  clearLocalBoards(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.VERSION_KEY);
    } catch (error) {
      console.error('Error clearing local boards:', error);
    }
  }

  // Fix boards that might have been created with incorrect IDs
  fixBoardIds(): boolean {
    try {
      // Use direct localStorage access to avoid recursion
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return false;
      
      const boards = JSON.parse(stored);
      if (!Array.isArray(boards)) return false;
      
      let hasChanges = false;
      
      const fixedBoards = boards.map(board => {
        // If board ID doesn't start with local_, fix it
        if (board && typeof board === 'object' && board.id && !board.id.startsWith('local_')) {
          console.log(`Fixing board ID: ${board.id} -> local_${board.id}`);
          hasChanges = true;
          return {
            ...board,
            id: `local_${board.id}`
          };
        }
        return board;
      });
      
      if (hasChanges) {
        this.saveBoards(fixedBoards);
        console.log('Fixed board IDs in local storage');
      }
      
      return hasChanges;
    } catch (error) {
      console.error('Error fixing board IDs:', error);
      return false;
    }
  }

  // Get count of local boards
  getLocalBoardCount(): number {
    return this.getStoredBoards().length;
  }

  // Data validation and migration
  private ensureVersionCompatibility(): void {
    // Guard against SSR environments where localStorage is not available
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    const currentVersion = localStorage.getItem(this.VERSION_KEY);

    // Skip if we've already validated this version in the current session
    if (this.hasCheckedVersion && currentVersion === this.CURRENT_VERSION) {
      return;
    }
    
    if (currentVersion !== this.CURRENT_VERSION) {
      console.log('Migrating local boards to new version...');
      this.migrateLocalBoards(currentVersion || '1.0');
      // Ensure the version marker is updated even when there were no boards to migrate
      localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
    }

    this.hasCheckedVersion = true;
    
    // Note: Removed fixBoardIds call to prevent infinite recursion
    // fixBoardIds should be called manually when needed
  }

  private migrateLocalBoards(fromVersion: string): void {
    if (fromVersion === '1.0') {
      // Migration from version 1.0 to 2.0: add labels support
      try {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
          const boards: LocalBoard[] = JSON.parse(data);
          for (const board of boards) {
            if (!board.labels) {
              board.labels = [
                { id: `${board.id}_label_1`, name: 'Bug', color: '#ef4444' },
                { id: `${board.id}_label_2`, name: 'Feature', color: '#3b82f6' },
                { id: `${board.id}_label_3`, name: 'Enhancement', color: '#8b5cf6' },
                { id: `${board.id}_label_4`, name: 'Urgent', color: '#f59e0b' },
                { id: `${board.id}_label_5`, name: 'Low Priority', color: '#6b7280' }
              ];
            }
            // Ensure all cards have labels array
            for (const column of board.columns) {
              for (const card of column.cards) {
                if (!card.labels) {
                  card.labels = [];
                }
                if (!card.attachments) {
                  card.attachments = [];
                }
              }
            }
            board.version = this.CURRENT_VERSION;
          }
          this.saveBoards(boards);
        }
      } catch (error) {
        console.error('Migration failed:', error);
        // If migration fails, clear storage to start fresh
        this.clearLocalBoards();
      }
    }
  }
}

export const localStorageService = new LocalStorageService(); 