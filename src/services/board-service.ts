import { v4 as uuidv4 } from 'uuid';
import type { Board, Card, Column, Label, Attachment, Comment } from '~/types';

// Constants
const API_ENDPOINT = '/api/boards';

// --- Error types ---
class BoardServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoardServiceError';
  }
}

class ItemNotFoundError extends BoardServiceError {
  constructor(itemType: string, itemId: string) {
    super(`${itemType} with ID ${itemId} not found`);
    this.name = 'ItemNotFoundError';
  }
}

// --- API Helpers ---
async function saveBoard(boardData: Board): Promise<void> {
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(boardData),
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) errMsg = body.error;
    } catch {}
    throw new Error(errMsg);
  }
}

async function fetchBoard(): Promise<Board> {
  const res = await fetch(API_ENDPOINT);
  if (!res.ok) {
    throw new Error(`Failed to fetch board: ${res.status}`);
  }
  return res.json();
}

// BoardService for managing the kanban board data
export class BoardService {
  /**
   * Gets the current board data
   */
  static async getBoard(): Promise<Board> {
    return await fetchBoard();
  }

  /**
   * Updates the board theme
   */
  static async updateTheme(theme: 'light' | 'dark'): Promise<Board> {
    const board = await this.getBoard();
    const updatedBoard = { ...board, theme };
    await saveBoard(updatedBoard);
    return updatedBoard;
  }

  /**
   * Finds a column by ID (internal helper method)
   */
  private static findColumn(board: Board, columnId: string): { column: Column; index: number } {
    const index = board.columns.findIndex((col) => col.id === columnId);
    if (index === -1) {
      throw new ItemNotFoundError('Column', columnId);
    }
    
    const column = board.columns[index];
    return { column, index };
  }
  
  /**
   * Finds a card by ID (internal helper method)
   */
  private static findCard(board: Board, cardId: string): { 
    card: Card; 
    column: Column; 
    columnIndex: number; 
    cardIndex: number 
  } {
    for (let i = 0; i < board.columns.length; i++) {
      const column = board.columns[i];
      const cardIndex = column.cards.findIndex(card => card.id === cardId);
      
      if (cardIndex !== -1) {
        return { 
          card: column.cards[cardIndex], 
          column, 
          columnIndex: i, 
          cardIndex 
        };
      }
    }
    
    throw new ItemNotFoundError('Card', cardId);
  }

  /**
   * Creates a new column
   */
  static async createColumn(title: string, width: number): Promise<Board> {
    const res = await fetch('/api/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, width }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create column: ${res.statusText}`);
    }
    return await this.getBoard();
  }

  /**
   * Updates a column
   */
  static async updateColumn(
    columnId: string,
    updates: Partial<Pick<Column, 'title' | 'width' | 'order'>>
  ): Promise<Board> {
    const res = await fetch(`/api/columns/${columnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      console.error(`Failed to update column ${columnId}:`, res.statusText);
    }
    return await this.getBoard();
  }

  /**
   * Moves a column to a new position
   */
  static async moveColumn(columnId: string, newIndex: number): Promise<Board> {
    const board = await this.getBoard();
    const columns = [...board.columns];
    const oldIndex = columns.findIndex(col => col.id === columnId);
    if (oldIndex === -1) throw new ItemNotFoundError('Column', columnId);
    const [moved] = columns.splice(oldIndex, 1);
    columns.splice(newIndex, 0, moved);
    // Persist new orders
    await Promise.all(columns.map((col, idx) =>
      fetch(`/api/columns/${col.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: idx }),
      })
    ));
    return await this.getBoard();
  }

  /**
   * Deletes a column
   */
  static async deleteColumn(columnId: string): Promise<Board> {
    const res = await fetch(`/api/columns/${columnId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(`Failed to delete column: ${res.statusText}`);
    }
    return await this.getBoard();
  }

  /**
   * Gets a card by ID
   */
  static async getCard(cardId: string): Promise<{ card: Card; column: Column }> {
    const board = await this.getBoard();
    return this.findCard(board, cardId);
  }

  /**
   * Creates a new card
   */
  static async createCard(
    columnId: string,
    cardData: Omit<Card, 'id' | 'columnId' | 'order' | 'labels' | 'assignees'>
  ): Promise<Board> {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columnId, ...cardData }),
    });
    if (!res.ok) {
      throw new Error(`Failed to create card: ${res.statusText}`);
    }
    return await this.getBoard();
  }

  /**
   * Updates a card
   */
  static async updateCard(
    cardId: string,
    updates: Partial<Omit<Card, 'id' | 'columnId' | 'order' | 'labels' | 'assignees'>> & { labels?: Label[]; assignees?: string[] }
  ): Promise<Board> {
    const res = await fetch(`/api/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      console.error(`Failed to update card ${cardId}:`, res.statusText);
    }
    return await this.getBoard();
  }

  /**
   * Moves a card to a new column/order
   */
  static async moveCard(
    cardId: string,
    targetColumnId: string,
    newOrder: number
  ): Promise<Board> {
    const res = await fetch(`/api/cards/${cardId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetColumnId, order: newOrder }),
    });
    if (!res.ok) {
      console.error(`Failed to move card ${cardId}:`, res.statusText);
    }
    return await this.getBoard();
  }

  /**
   * Deletes a card
   */
  static async deleteCard(cardId: string): Promise<Board> {
    const res = await fetch(`/api/cards/${cardId}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`Failed to delete card: ${res.statusText}`);
    }
    return await this.getBoard();
  }

  /**
   * Duplicates a card
   */
  static async duplicateCard(cardId: string, targetColumnId?: string): Promise<Board> {
    const board = await this.getBoard();
    let originalCard: Card | null = null;
    let originalColumn: Column | null = null;
    let originalColumnIndex = -1;
    let originalCardIndex = -1;

    // Find the original card and its column
    for (let i = 0; i < board.columns.length; i++) {
        const col = board.columns[i];
        const cardIndex = col.cards.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            originalCard = col.cards[cardIndex];
            originalColumn = col;
            originalColumnIndex = i;
            originalCardIndex = cardIndex;
            break;
        }
    }

    if (!originalCard || !originalColumn) {
        throw new Error(`Card with ID ${cardId} not found for duplication.`);
    }

    const finalTargetColumnId = targetColumnId || originalColumn.id;
    const targetColumnIndex = board.columns.findIndex(col => col.id === finalTargetColumnId);
    if (targetColumnIndex === -1) {
        throw new Error(`Target column with ID ${finalTargetColumnId} not found.`);
    }

    const targetColumn = board.columns[targetColumnIndex];
    
    // Determine the insert index for the new card: after the original card in the same column or at the end of target
    const insertIndex = finalTargetColumnId === originalColumn.id
      ? originalCardIndex + 1
      : targetColumn.cards.length;

    const duplicatedCard: Card = {
        ...originalCard,
        id: uuidv4(), // Generate a new unique ID
        title: `(Copy) ${originalCard.title}`, // Prefix title with (Copy)
        columnId: finalTargetColumnId,
        order: insertIndex,
        // Deep copy arrays/objects to avoid reference issues if needed (optional)
        labels: originalCard.labels.map(label => ({ ...label, id: uuidv4() })), // New IDs for labels if needed
        attachments: originalCard.attachments.map(att => ({ ...att, id: uuidv4() })), // New IDs
        comments: originalCard.comments.map(com => ({ ...com, id: uuidv4() })), // New IDs
    };

    let updatedBoard = { ...board, columns: [...board.columns] };

    // Insert the duplicated card into the target column
    const updatedTargetCards = [
        ...targetColumn.cards.slice(0, insertIndex),
        duplicatedCard,
        ...targetColumn.cards.slice(insertIndex)
    ].map((card, index) => ({ // Re-order cards in the target column
        ...card,
        order: index
    }));

    updatedBoard.columns[targetColumnIndex] = {
        ...targetColumn,
        cards: updatedTargetCards,
    };

    // If the card was duplicated within the same column, ensure source column is updated
    if (finalTargetColumnId === originalColumn.id) {
         updatedBoard.columns[originalColumnIndex] = updatedBoard.columns[targetColumnIndex];
    }

    // Persist changes
    await saveBoard(updatedBoard);
    return updatedBoard;
  }

  /**
   * Adds a label to a card
   */
  static async addLabel(
    cardId: string,
    name: string,
    color: string
  ): Promise<Board> {
    const board = await this.getBoard();
    
    const updatedColumns = board.columns.map((column) => {
      const cardIndex = column.cards.findIndex((card) => card.id === cardId);
      
      if (cardIndex === -1) {
        return column;
      }
      
      const card = column.cards[cardIndex];
      
      if (!card) {
        return column;
      }
      
      const newLabel: Label = {
        id: uuidv4(),
        name,
        color,
      };
      
      const updatedCard = {
        ...card,
        labels: [...(card.labels || []), newLabel],
      };
      
      const updatedCards = [...column.cards];
      updatedCards[cardIndex] = updatedCard;
      
      return {
        ...column,
        cards: updatedCards,
      };
    });
    
    const updatedBoard = {
      ...board,
      columns: updatedColumns,
    };
    
    await saveBoard(updatedBoard);
    return updatedBoard;
  }

  /**
   * Removes a label from a card
   */
  static async removeLabel(cardId: string, labelId: string): Promise<Board> {
    const board = await this.getBoard();
    
    const updatedColumns = board.columns.map((column) => {
      const cardIndex = column.cards.findIndex((card) => card.id === cardId);
      
      if (cardIndex === -1) {
        return column;
      }
      
      const card = column.cards[cardIndex];
      
      if (!card) {
        return column;
      }
      
      const updatedCard = {
        ...card,
        labels: card.labels?.filter((label) => label.id !== labelId) || [],
      };
      
      const updatedCards = [...column.cards];
      updatedCards[cardIndex] = updatedCard;
      
      return {
        ...column,
        cards: updatedCards,
      };
    });
    
    const updatedBoard = {
      ...board,
      columns: updatedColumns,
    };
    
    await saveBoard(updatedBoard);
    return updatedBoard;
  }

  /**
   * Adds a comment to a card
   */
  static async addComment(
    cardId: string,
    author: string,
    content: string
  ): Promise<Board> {
    const commentData = { author, content };
    
    // Create the new comment object
    const newComment: Comment = {
      id: uuidv4(),
      author: commentData.author || 'User',
      content: commentData.content,
      createdAt: new Date(),
    };

    // Update the board state locally first
    const board = await this.getBoard();
    const updatedColumns = board.columns.map((column) => {
      const cardIndex = column.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return column;
      const updatedCards = [...column.cards];
      const card = updatedCards[cardIndex];
      if (!card) return column;
      updatedCards[cardIndex] = {
        ...card,
        comments: [...(card.comments || []), newComment],
      };
      return { ...column, cards: updatedCards };
    });
    const updatedBoard = { ...board, columns: updatedColumns };
    
    // Persist changes using the fallback mechanism
    await saveBoard(updatedBoard);
    return updatedBoard;
  }

  /**
   * Deletes a comment from a card
   */
  static async deleteComment(cardId: string, commentId: string): Promise<Board> {
    // Update the board state locally first
    const board = await this.getBoard();
    const updatedColumns = board.columns.map((column) => {
      const cardIndex = column.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return column;
      const updatedCards = [...column.cards];
      const card = updatedCards[cardIndex];
      if (!card || !card.comments) return column;
      updatedCards[cardIndex] = {
        ...card,
        comments: card.comments.filter(c => c.id !== commentId),
      };
      return { ...column, cards: updatedCards };
    });
    const updatedBoard = { ...board, columns: updatedColumns };

    // Persist changes using the fallback mechanism
    await saveBoard(updatedBoard);
    return updatedBoard;
  }

  /**
   * Adds an attachment to a card
   */
  static async addAttachment(
    cardId: string,
    name: string,
    url: string,
    type: string
  ): Promise<Board> {
    const attachmentData = { name, url, type };

    // Create the new attachment object
    const newAttachment: Attachment = {
        id: uuidv4(),
        name: attachmentData.name,
        url: attachmentData.url,
        type: attachmentData.type || 'link',
        createdAt: new Date(),
    };

    // Update the board state locally first
    const board = await this.getBoard();
    const updatedColumns = board.columns.map((column) => {
      const cardIndex = column.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return column;
      const updatedCards = [...column.cards];
      const card = updatedCards[cardIndex];
      if (!card) return column;
      updatedCards[cardIndex] = {
        ...card,
        attachments: [...(card.attachments || []), newAttachment],
      };
      return { ...column, cards: updatedCards };
    });
    const updatedBoard = { ...board, columns: updatedColumns };

    // Persist changes using the fallback mechanism
    await saveBoard(updatedBoard);
    return updatedBoard;
  }

  /**
   * Deletes an attachment from a card
   */
  static async deleteAttachment(cardId: string, attachmentId: string): Promise<Board> {
    // Update the board state locally first
    const board = await this.getBoard();
    const updatedColumns = board.columns.map((column) => {
      const cardIndex = column.cards.findIndex((c) => c.id === cardId);
      if (cardIndex === -1) return column;
      const updatedCards = [...column.cards];
      const card = updatedCards[cardIndex];
      if (!card || !card.attachments) return column;
      updatedCards[cardIndex] = {
        ...card,
        attachments: card.attachments.filter(a => a.id !== attachmentId),
      };
      return { ...column, cards: updatedCards };
    });
    const updatedBoard = { ...board, columns: updatedColumns };

    // Persist changes using the fallback mechanism
    await saveBoard(updatedBoard);
    return updatedBoard;
  }
} 