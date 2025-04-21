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
    const board = await this.getBoard();
    const newColumn: Column = { id: uuidv4(), title, width, order: board.columns.length, cards: [] };
    const updatedBoard = { ...board, columns: [...board.columns, newColumn] };
    await saveBoard(updatedBoard);
    return updatedBoard;
  }

  /**
   * Updates a column
   */
  static async updateColumn(
    columnId: string,
    updates: Partial<Pick<Column, 'title' | 'width'>>
  ): Promise<Board> {
    const board = await this.getBoard();
    try {
      const { index } = this.findColumn(board, columnId);
      const updatedColumns = [...board.columns];
      updatedColumns[index] = { ...updatedColumns[index], ...updates };
      const updatedBoard = { ...board, columns: updatedColumns };
      await saveBoard(updatedBoard);
      return updatedBoard;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        console.error(error.message);
        return board;
      }
      throw error;
    }
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
    // Update order property on each column
    const orderedColumns = columns.map((col, idx) => ({ ...col, order: idx }));
    const updatedBoard = { ...board, columns: orderedColumns };
    await saveBoard(updatedBoard);
    return updatedBoard;
  }

  /**
   * Deletes a column
   */
  static async deleteColumn(columnId: string): Promise<Board> {
    const board = await this.getBoard();
    const updatedBoard = { ...board, columns: board.columns.filter((col) => col.id !== columnId) };
    await saveBoard(updatedBoard);
    return updatedBoard;
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
    cardData: Omit<Card, 'id' | 'columnId' | 'order'>
  ): Promise<Board> {
    const board = await this.getBoard();
    try {
      const { column, index: columnIndex } = this.findColumn(board, columnId);
      const order = column.cards.length > 0 ? Math.max(...column.cards.map(c => c.order)) + 1 : 0;
      const newCard: Card = { id: uuidv4(), columnId, order, ...cardData };
      const updatedColumns = [...board.columns];
      updatedColumns[columnIndex] = { ...column, cards: [...column.cards, newCard] };
      const updatedBoard = { ...board, columns: updatedColumns };
      await saveBoard(updatedBoard);
      return updatedBoard;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        console.error(error.message);
        return board;
      }
      throw error;
    }
  }

  /**
   * Updates a card
   */
  static async updateCard(
    cardId: string,
    updates: Partial<Omit<Card, 'id' | 'columnId' | 'order'>>
  ): Promise<Board> {
    const board = await this.getBoard();
    try {
      const { card, column, columnIndex, cardIndex } = this.findCard(board, cardId);
      const updatedCards = [...column.cards];
      updatedCards[cardIndex] = { ...card, ...updates };
      const updatedBoard = { ...board, columns: board.columns.map((col, idx) => idx === columnIndex ? { ...column, cards: updatedCards } : col) };
      await saveBoard(updatedBoard);
      return updatedBoard;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        console.error(error.message);
        return board;
      }
      throw error;
    }
  }

  /**
   * Moves a card to a different column or position
   */
  static async moveCard(
    cardId: string,
    targetColumnId: string,
    newOrder: number
  ): Promise<Board> {
    const board = await this.getBoard();

    try {
      // Find the card to move
      const { card, column: sourceColumn, columnIndex: sourceColumnIndex, cardIndex } =
        this.findCard(board, cardId);
      // Clone all columns with their cards
      const updatedColumns = board.columns.map(col => ({ ...col, cards: [...col.cards] }));

      if (sourceColumn.id === targetColumnId) {
        // Intra-column move: remove and reinsert at new index
        const cards = updatedColumns[sourceColumnIndex].cards;
        cards.splice(cardIndex, 1);
        cards.splice(newOrder, 0, { ...card, columnId: targetColumnId });
        // Renumber orders
        updatedColumns[sourceColumnIndex].cards = cards.map((c, idx) => ({ ...c, order: idx }));
      } else {
        // Cross-column move: remove from source
        const sourceCards = updatedColumns[sourceColumnIndex].cards.filter(c => c.id !== cardId);
        // Renumber source column
        updatedColumns[sourceColumnIndex].cards = sourceCards.map((c, idx) => ({ ...c, order: idx }));
        // Insert into target column
        const { column: targetColumn, index: targetColumnIndex } = this.findColumn(board, targetColumnId);
        const targetCards = [...targetColumn.cards];
        targetCards.splice(newOrder, 0, { ...card, columnId: targetColumnId });
        // Renumber target column
        updatedColumns[targetColumnIndex].cards = targetCards.map((c, idx) => ({ ...c, order: idx }));
      }

      const updatedBoard = { ...board, columns: updatedColumns };
      await saveBoard(updatedBoard);
      return updatedBoard;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        console.error(error.message);
        return board; // Return unchanged board if items not found
      }
      throw error;
    }
  }

  /**
   * Deletes a card
   */
  static async deleteCard(cardId: string): Promise<Board> {
    const board = await this.getBoard();
    
    const updatedColumns = board.columns.map((column) => {
      return {
        ...column,
        cards: column.cards.filter((card) => card.id !== cardId),
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