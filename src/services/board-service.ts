import { v4 as uuidv4 } from 'uuid';
import type { Board, Card, Column, Label, Attachment, Comment } from '~/types';
import { createDefaultBoard } from '~/types/defaults';

// Local storage key for board data
const BOARD_STORAGE_KEY = 'kanban_board_data';

/**
 * Helper functions for localStorage operations in static/production environments
 */
const LocalStorage = {
  // Get the board from localStorage
  getBoard: async (): Promise<Board> => {
    const storedData = localStorage.getItem(BOARD_STORAGE_KEY);
    
    if (storedData) {
      try {
        return JSON.parse(storedData);
      } catch (e) {
        console.error('Error parsing stored board data:', e);
      }
    }
    
    // If no stored data or parsing error, fetch the static JSON
    try {
      const response = await fetch('/data/board.json');
      if (response.ok) {
        const initialData = await response.json();
        localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(initialData));
        return initialData;
      }
    } catch (e) {
      console.error('Error fetching initial board data:', e);
    }
    
    // Fallback to default board
    const defaultBoard = createDefaultBoard();
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(defaultBoard));
    return defaultBoard;
  },
  
  // Save the board to localStorage
  saveBoard: (board: Board): void => {
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(board));
  },
  
  // Update the board in localStorage and return the updated board
  updateBoard: async (updateFn: (board: Board) => Board): Promise<Board> => {
    const board = await LocalStorage.getBoard();
    const updatedBoard = updateFn(board);
    LocalStorage.saveBoard(updatedBoard);
    return updatedBoard;
  }
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
    // Use localStorage for production/static environment
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      return await LocalStorage.getBoard();
    }
    
    // Use API for development environment
    const response = await fetch('/api/board', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch board data');
    }
    
    return await response.json();
  }

  /**
   * Updates the board theme
   * @param theme The new theme value
   * @returns The updated board
   */
  static async updateTheme(theme: 'light' | 'dark'): Promise<Board> {
    // Use localStorage for production/static environment
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      return await LocalStorage.updateBoard((board) => {
        board.theme = theme;
        return board;
      });
    }
    
    // Use API for development environment
    const response = await fetch('/api/board', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateTheme',
        theme,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update theme');
    }
    
    return await response.json();
  }

  /**
   * Gets a column by ID
   * @param columnId The column ID
   * @returns The column or undefined if not found
   */
  static async getColumn(columnId: string): Promise<Column | undefined> {
    const board = await this.getBoard();
    return board.columns.find((col) => col.id === columnId);
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
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create column');
    }
    
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
    
    const updatedColumns = board.columns.map((col) => {
      if (col.id === columnId) {
        return { ...col, ...updates };
      }
      return col;
    });
    
    const updatedBoard = {
      ...board,
      columns: updatedColumns,
    };
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update column');
    }
    
    return updatedBoard;
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
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete column');
    }
    
    return updatedBoard;
  }

  /**
   * Gets a card by ID
   * @param cardId The card ID
   * @returns The card and its column or undefined if not found
   */
  static async getCard(
    cardId: string
  ): Promise<{ card: Card; column: Column } | undefined> {
    const board = await this.getBoard();
    
    for (const column of board.columns) {
      const card = column.cards.find((c) => c.id === cardId);
      if (card) {
        return { card, column };
      }
    }
    
    return undefined;
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
    
    const columnIndex = board.columns.findIndex((col) => col.id === columnId);
    
    if (columnIndex === -1) {
      throw new Error(`Column with ID ${columnId} not found`);
    }
    
    const column = board.columns[columnIndex];
    
    // Check if column exists
    if (!column) {
      throw new Error(`Column with index ${columnIndex} not found`);
    }
    
    // Get the highest order value and add 1
    const order =
      column.cards.length > 0
        ? Math.max(...column.cards.map((card) => card.order)) + 1
        : 0;
    
    const newCard: Card = {
      id: uuidv4(),
      columnId,
      order,
      ...cardData,
    };
    
    const updatedColumns = [...board.columns];
    updatedColumns[columnIndex] = {
      ...column,
      cards: [...column.cards, newCard],
    };
    
    const updatedBoard = {
      ...board,
      columns: updatedColumns,
    };
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create card');
    }
    
    return updatedBoard;
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
    
    const updatedColumns = board.columns.map((column) => {
      const cardIndex = column.cards.findIndex((card) => card.id === cardId);
      
      if (cardIndex === -1) {
        return column;
      }
      
      const updatedCards = [...column.cards];
      const existingCard = updatedCards[cardIndex];
      
      if (!existingCard) {
        return column;
      }
      
      updatedCards[cardIndex] = {
        ...existingCard,
        ...updates,
      } as Card;
      
      return {
        ...column,
        cards: updatedCards,
      };
    });
    
    const updatedBoard = {
      ...board,
      columns: updatedColumns,
    };
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update card');
    }
    
    return updatedBoard;
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

    // Find the card and its source column
    let cardToMove: Card | undefined;
    let sourceColumnIndex = -1;
    let sourceColumn: Column | undefined;

    for (let i = 0; i < board.columns.length; i++) {
      const column = board.columns[i];
      if (!column) continue;
      const card = column.cards.find((c) => c.id === cardId);
      if (card) {
        cardToMove = card;
        sourceColumnIndex = i;
        sourceColumn = column;
        break;
      }
    }

    if (!cardToMove || sourceColumnIndex === -1 || !sourceColumn) {
      // It's possible the card data is slightly stale, refresh and retry once
      console.warn(`Card ${cardId} not found initially, refreshing board data and retrying move...`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay before refetch
      const refreshedBoard = await this.getBoard();
      for (let i = 0; i < refreshedBoard.columns.length; i++) {
        const column = refreshedBoard.columns[i];
        if (!column) continue;
        const card = column.cards.find((c) => c.id === cardId);
        if (card) {
          cardToMove = card;
          sourceColumnIndex = i;
          sourceColumn = column;
          board.columns = refreshedBoard.columns; // Use refreshed data
          break;
        }
      }
      // If still not found after refresh, throw error
      if (!cardToMove || sourceColumnIndex === -1 || !sourceColumn) {
         throw new Error(`Card with ID ${cardId} not found even after refresh`);
      }
    }

    // Find the target column
    const targetColumnIndex = board.columns.findIndex(
      (col) => col.id === targetColumnId
    );
    const targetColumn = board.columns[targetColumnIndex];

    if (targetColumnIndex === -1 || !targetColumn) {
      throw new Error(`Target column with ID ${targetColumnId} not found`);
    }

    const updatedColumns = [...board.columns];

    // Create the card with its new properties (including the calculated newOrder)
    const updatedCard: Card = {
      ...cardToMove,
      columnId: targetColumnId, 
      order: newOrder,
    };

    // --- Handle the move --- 
    if (sourceColumnIndex === targetColumnIndex) {
      // --- Moving within the same column --- 
      const currentColumn = { ...updatedColumns[sourceColumnIndex] } as Column;
      
      // Ensure cards array exists
      if (!currentColumn.cards) { 
        currentColumn.cards = [];
      }
      
      // Update the specific card's order directly in the array
      currentColumn.cards = currentColumn.cards
        .map((card) => {
          if (card.id === cardId) {
            return updatedCard; // Replace with the card having the new order
          }
          return card;
        })
        .sort((a, b) => a.order - b.order); // Re-sort based on potentially updated orders

      updatedColumns[sourceColumnIndex] = currentColumn;

    } else {
      // --- Moving to a different column --- 
      // 1. Remove card from source column
      const currentSourceColumn = { ...updatedColumns[sourceColumnIndex] } as Column;
      if (!currentSourceColumn.cards) { 
        currentSourceColumn.cards = [];
      }
      currentSourceColumn.cards = currentSourceColumn.cards.filter(
        (card) => card.id !== cardId
      );
      updatedColumns[sourceColumnIndex] = currentSourceColumn;

      // 2. Add card to target column
      const currentTargetColumn = { ...updatedColumns[targetColumnIndex] } as Column;
      if (!currentTargetColumn.cards) { 
        currentTargetColumn.cards = [];
      }
      // Add the updated card and sort. Assumes newOrder is correctly calculated (fractional)
      currentTargetColumn.cards = [...currentTargetColumn.cards, updatedCard]
        .sort((a, b) => a.order - b.order);

      updatedColumns[targetColumnIndex] = currentTargetColumn;
    }

    // --- Finalize --- 
    const finalUpdatedBoard = {
      ...board,
      columns: updatedColumns,
    };

    // --- Persist the changes --- 
    try {
      // Use localStorage for production/static environment
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
         LocalStorage.saveBoard(finalUpdatedBoard);
         // Add a small delay to allow localStorage to potentially write before returning
         await new Promise(resolve => setTimeout(resolve, 10)); 
         return finalUpdatedBoard;
      }

      // Use API for development environment (assuming POST replaces the board)
      const response = await fetch('/api/board', {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalUpdatedBoard),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('API Error Response:', errorBody);
        throw new Error(`Failed to move card via API. Status: ${response.status}`);
      }
      
      // Assuming the API returns the fully updated board state
      const responseData = await response.json(); 
      return responseData as Board;

    } catch (error) {
      console.error("Error persisting board state after move:", error);
      // Optionally re-throw or handle the error state in the context
      throw error; // Re-throw to allow context to catch it
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
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete card');
    }
    
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
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to add label');
    }
    
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
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to remove label');
    }
    
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
      
      const newComment: Comment = {
        id: uuidv4(),
        author,
        content,
        createdAt: new Date(),
      };
      
      const updatedCard = {
        ...card,
        comments: [...(card.comments || []), newComment],
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
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to add comment');
    }
    
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
      
      const newAttachment: Attachment = {
        id: uuidv4(),
        name,
        url,
        type,
        createdAt: new Date(),
      };
      
      const updatedCard = {
        ...card,
        attachments: [...(card.attachments || []), newAttachment],
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
    
    const response = await fetch('/api/board', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatedBoard),
    });
    
    if (!response.ok) {
      throw new Error('Failed to add attachment');
    }
    
    return updatedBoard;
  }
} 