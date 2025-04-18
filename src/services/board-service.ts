import { v4 as uuidv4 } from 'uuid';
import type { Board, Card, Column, Label, Attachment, Comment } from '~/types';
import { createDefaultBoard } from '~/types/defaults';

// Constants
const BOARD_STORAGE_KEY = 'kanban_board_data';
const API_ENDPOINT = '/api/boards'; // Standardized API endpoint
const STATIC_BOARD_PATH = '/data/board.json'; // Path to static JSON

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

// --- Robust Save/Load Helpers --- 

/**
 * Saves the board data, trying API first and falling back to localStorage.
 * @param boardData The board data to save.
 * @returns boolean indicating if server save was successful.
 */
const saveBoardWithFallback = async (boardData: Board): Promise<boolean> => {
  try {
    // 1. Try saving to server API
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(boardData),
    });

    if (response.ok) {
      // 2. If server save successful, also update localStorage
      localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boardData));
      return true; // Server save succeeded
    } else {
      console.warn(`Server save failed with status ${response.status}. Falling back to localStorage only.`);
      response.text().then(body => console.warn("Server response body:", body)).catch(() => {});
      // 3. If server save failed, save only to localStorage
      localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boardData));
      return false; // Server save failed
    }
  } catch (error) {
    console.error('Error saving board (API or network issue). Falling back to localStorage only:', error);
    // 4. On network error or other issues, save only to localStorage
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boardData));
    return false; // Server save failed
  }
};

/**
 * Loads the board data, trying API first, then localStorage, then static JSON, then default.
 * @returns The loaded board data.
 */
const loadBoardWithFallback = async (): Promise<Board> => {
  let loadedBoard: Board | null = null;
  let source: string = 'unknown';

  try {
    // 1. Try loading from server API
    const apiResponse = await fetch(API_ENDPOINT, { method: 'GET', credentials: 'omit' });
    if (apiResponse.ok) {
      loadedBoard = await apiResponse.json();
      source = 'API';
      // Update localStorage with the latest data from the server
      if (loadedBoard) {
         localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(loadedBoard));
      }
    } else {
      console.warn(`Failed to load from API (status ${apiResponse.status}). Trying localStorage.`);
    }
  } catch (error) {
    console.warn('Error loading from API. Trying localStorage:', error);
  }

  // 2. If API failed or returned no data, try loading from localStorage
  if (!loadedBoard) {
    const localData = localStorage.getItem(BOARD_STORAGE_KEY);
    if (localData) {
      try {
        loadedBoard = JSON.parse(localData);
        source = 'localStorage';
      } catch (e) {
        console.error('Error parsing localStorage data. Trying static JSON:', e);
      }
    }
  }

  // 3. If localStorage failed or was empty, try loading from static JSON
  if (!loadedBoard) {
    try {
      const staticResponse = await fetch(STATIC_BOARD_PATH);
      if (staticResponse.ok) {
        loadedBoard = await staticResponse.json();
        source = 'static JSON';
        // Save the initial static data to localStorage
        if (loadedBoard) {
          localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(loadedBoard));
        }
      } else {
         console.warn(`Failed to load static JSON (status ${staticResponse.status}). Using default board.`);
      }
    } catch (e) {
      console.error('Error fetching static JSON. Using default board:', e);
    }
  }

  // 4. If all else fails, create a default board
  if (!loadedBoard) {
    console.warn('All loading methods failed. Creating default board.');
    loadedBoard = createDefaultBoard();
    source = 'default';
    // Save the default board to localStorage
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(loadedBoard));
  }

  // Debug logging of source removed for production
  return loadedBoard;
};

/**
 * Service for managing the kanban board data
 */
export class BoardService {
  /**
   * Gets the current board data
   * @returns The board data
   */
  static async getBoard(): Promise<Board> {
    // Always use the fallback logic for consistency
    return await loadBoardWithFallback();
  }

  /**
   * Updates the board theme
   * @param theme The new theme value
   * @returns The updated board
   */
  static async updateTheme(theme: 'light' | 'dark'): Promise<Board> {
    const board = await this.getBoard();
    const updatedBoard = { ...board, theme };
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Finds a column by ID (internal helper method)
   * @param board The board containing columns
   * @param columnId The column ID to find
   * @returns The column and its index or throws if not found
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
   * @param board The board containing columns and cards
   * @param cardId The card ID to find
   * @returns The card, its column, and indices or throws if not found
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
   * Gets a column by ID
   * @param columnId The column ID
   * @returns The column or undefined if not found
   */
  static async getColumn(columnId: string): Promise<Column> {
    const board = await this.getBoard();
    const { column } = this.findColumn(board, columnId);
    return column;
  }

  /**
   * Creates a new column
   * @param title The column title
   * @param width The column width (percentage or pixels)
   * @returns The updated board
   */
  static async createColumn(title: string, width: number): Promise<Board> {
    const board = await this.getBoard();
    
    const newColumn: Column = {
      id: uuidv4(),
      title,
      width,
      cards: [],
    };
    
    const updatedBoard = {
      ...board,
      columns: [...board.columns, newColumn],
    };
    
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Updates a column
   * @param columnId The column ID
   * @param updates The column updates
   * @returns The updated board
   */
  static async updateColumn(
    columnId: string,
    updates: Partial<Pick<Column, 'title' | 'width'>>
  ): Promise<Board> {
    const board = await this.getBoard();
    
    try {
      const { index } = this.findColumn(board, columnId);
      
      // Create a new columns array with the updated column
      const updatedColumns = [...board.columns];
      updatedColumns[index] = {
        ...updatedColumns[index],
        ...updates
      };
      
      const updatedBoard = {
        ...board,
        columns: updatedColumns,
      };
      
      await saveBoardWithFallback(updatedBoard);
      return updatedBoard;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        console.error(error.message);
        return board; // Return unchanged board if column not found
      }
      throw error;
    }
  }

  /**
   * Deletes a column
   * @param columnId The column ID
   * @returns The updated board
   */
  static async deleteColumn(columnId: string): Promise<Board> {
    const board = await this.getBoard();
    
    const updatedBoard = {
      ...board,
      columns: board.columns.filter((col) => col.id !== columnId),
    };
    
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Gets a card by ID
   * @param cardId The card ID
   * @returns The card and its column
   */
  static async getCard(cardId: string): Promise<{ card: Card; column: Column }> {
    const board = await this.getBoard();
    const { card, column } = this.findCard(board, cardId);
    return { card, column };
  }

  /**
   * Creates a new card
   * @param columnId The column ID
   * @param cardData The card data
   * @returns The updated board
   */
  static async createCard(
    columnId: string,
    cardData: Omit<Card, 'id' | 'columnId' | 'order'>
  ): Promise<Board> {
    const board = await this.getBoard();
    
    try {
      const { column, index: columnIndex } = this.findColumn(board, columnId);
      
      // Get the highest order value and add 1
      const order = column.cards.length > 0
        ? Math.max(...column.cards.map((card) => card.order)) + 1
        : 0;
      
      const newCard: Card = {
        id: uuidv4(),
        columnId,
        order,
        ...cardData,
      };
      
      // Create a new columns array with the updated column
      const updatedColumns = [...board.columns];
      updatedColumns[columnIndex] = {
        ...column,
        cards: [...column.cards, newCard],
      };
      
      const updatedBoard = {
        ...board,
        columns: updatedColumns,
      };
      
      await saveBoardWithFallback(updatedBoard);
      return updatedBoard;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        console.error(error.message);
        return board; // Return unchanged board if column not found
      }
      throw error;
    }
  }

  /**
   * Updates a card
   * @param cardId The card ID
   * @param updates The card updates
   * @returns The updated board
   */
  static async updateCard(
    cardId: string,
    updates: Partial<Omit<Card, 'id' | 'columnId' | 'order'>>
  ): Promise<Board> {
    const board = await this.getBoard();
    
    try {
      const { card, column, columnIndex, cardIndex } = this.findCard(board, cardId);
      
      // Create a new cards array with the updated card
      const updatedCards = [...column.cards];
      updatedCards[cardIndex] = {
        ...card,
        ...updates,
      };
      
      // Create a new columns array with the updated column
      const updatedColumns = [...board.columns];
      updatedColumns[columnIndex] = {
        ...column,
        cards: updatedCards,
      };
      
      const updatedBoard = {
        ...board,
        columns: updatedColumns,
      };
      
      await saveBoardWithFallback(updatedBoard);
      return updatedBoard;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        console.error(error.message);
        return board; // Return unchanged board if card not found
      }
      throw error;
    }
  }

  /**
   * Moves a card to a different column or position
   * @param cardId The card ID
   * @param targetColumnId The target column ID
   * @param newOrder The new order value in the target column
   * @returns The updated board
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
      
      // Handle in-column reordering vs. cross-column move
      if (sourceColumn.id === targetColumnId) {
        // Same column - just update the order
        const updatedCards = [...sourceColumn.cards];
        updatedCards[cardIndex] = {
          ...card,
          order: newOrder,
        };
        
        // Sort the cards by order
        updatedCards.sort((a, b) => a.order - b.order);
        
        // Create a new columns array with the updated column
        const updatedColumns = [...board.columns];
        updatedColumns[sourceColumnIndex] = {
          ...sourceColumn,
          cards: updatedCards,
        };
        
        const updatedBoard = {
          ...board,
          columns: updatedColumns,
        };
        
        await saveBoardWithFallback(updatedBoard);
        return updatedBoard;
      } else {
        // Different column - remove from source, add to target
        const { column: targetColumn, index: targetColumnIndex } = 
          this.findColumn(board, targetColumnId);
        
        // Remove card from source column
        const updatedSourceCards = sourceColumn.cards.filter(c => c.id !== cardId);
        
        // Add card to target column with new properties
        const updatedCard: Card = {
          ...card,
          columnId: targetColumnId,
          order: newOrder,
        };
        
        const updatedTargetCards = [...targetColumn.cards, updatedCard];
        updatedTargetCards.sort((a, b) => a.order - b.order);
        
        // Create a new columns array with both updated columns
        const updatedColumns = [...board.columns];
        updatedColumns[sourceColumnIndex] = {
          ...sourceColumn,
          cards: updatedSourceCards,
        };
        updatedColumns[targetColumnIndex] = {
          ...targetColumn,
          cards: updatedTargetCards,
        };
        
        const updatedBoard = {
          ...board,
          columns: updatedColumns,
        };
        
        await saveBoardWithFallback(updatedBoard);
        return updatedBoard;
      }
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
   * @param cardId The card ID
   * @returns The updated board
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
    
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Duplicates a card
   * @param cardId The ID of the card to duplicate
   * @param targetColumnId Optional ID of the column to place the duplicate in (defaults to original column)
   * @returns The updated board
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
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Adds a label to a card
   * @param cardId The card ID
   * @param name The label name
   * @param color The label color
   * @returns The updated board
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
    
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Removes a label from a card
   * @param cardId The card ID
   * @param labelId The label ID
   * @returns The updated board
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
    
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Adds a comment to a card
   * @param cardId The card ID
   * @param author The comment author
   * @param content The comment content
   * @returns The updated board
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
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Deletes a comment from a card
   * @param cardId The card ID
   * @param commentId The comment ID
   * @returns The updated board
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
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Adds an attachment to a card
   * @param cardId The card ID
   * @param name The attachment name
   * @param url The attachment URL
   * @param type The attachment type
   * @returns The updated board
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
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }

  /**
   * Deletes an attachment from a card
   * @param cardId The card ID
   * @param attachmentId The attachment ID
   * @returns The updated board
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
    await saveBoardWithFallback(updatedBoard);
    return updatedBoard;
  }
} 