import { v4 as uuidv4 } from 'uuid';
import { Board, Card, Column, Label, Attachment, Comment } from '~/types';

/**
 * Service for managing the kanban board data
 */
export class BoardService {
  /**
   * Gets the current board data
   * @returns The board data
   */
  static async getBoard(): Promise<Board> {
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
      updatedCards[cardIndex] = {
        ...updatedCards[cardIndex],
        ...updates,
      };
      
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
   * Moves a card to a different column
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
    let cardIndex = -1;
    
    for (let i = 0; i < board.columns.length; i++) {
      const column = board.columns[i];
      const index = column.cards.findIndex((card) => card.id === cardId);
      
      if (index !== -1) {
        cardToMove = column.cards[index];
        sourceColumnIndex = i;
        cardIndex = index;
        break;
      }
    }
    
    if (!cardToMove) {
      throw new Error(`Card with ID ${cardId} not found`);
    }
    
    // Find the target column
    const targetColumnIndex = board.columns.findIndex(
      (col) => col.id === targetColumnId
    );
    
    if (targetColumnIndex === -1) {
      throw new Error(`Target column with ID ${targetColumnId} not found`);
    }
    
    // Remove the card from the source column
    const updatedColumns = [...board.columns];
    const sourceColumn = { ...updatedColumns[sourceColumnIndex] };
    sourceColumn.cards = sourceColumn.cards.filter((card) => card.id !== cardId);
    updatedColumns[sourceColumnIndex] = sourceColumn;
    
    // Add the card to the target column with the new order
    const targetColumn = { ...updatedColumns[targetColumnIndex] };
    
    // Update card properties for the new location
    const updatedCard: Card = {
      ...cardToMove,
      columnId: targetColumnId,
      order: newOrder,
    };
    
    // If we're moving within the same column, just update the order
    if (sourceColumnIndex === targetColumnIndex) {
      targetColumn.cards = sourceColumn.cards
        .map((card) => {
          if (card.id === cardId) {
            return updatedCard;
          }
          
          // Adjust other cards' orders as needed
          if (newOrder <= card.order && card.order < cardToMove.order) {
            return { ...card, order: card.order + 1 };
          }
          if (cardToMove.order < card.order && card.order <= newOrder) {
            return { ...card, order: card.order - 1 };
          }
          
          return card;
        })
        .sort((a, b) => a.order - b.order);
    } else {
      // Moving to a different column
      // Insert card at the specified order and adjust other cards
      targetColumn.cards = [
        ...targetColumn.cards.map((card) => {
          if (card.order >= newOrder) {
            return { ...card, order: card.order + 1 };
          }
          return card;
        }),
        updatedCard,
      ].sort((a, b) => a.order - b.order);
    }
    
    updatedColumns[targetColumnIndex] = targetColumn;
    
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
      throw new Error('Failed to move card');
    }
    
    return updatedBoard;
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
      const newLabel: Label = {
        id: uuidv4(),
        name,
        color,
      };
      
      const updatedCard = {
        ...card,
        labels: [...card.labels, newLabel],
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
      
      const updatedCard = {
        ...card,
        labels: card.labels.filter((label) => label.id !== labelId),
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
      const newComment: Comment = {
        id: uuidv4(),
        author,
        content,
        createdAt: new Date(),
      };
      
      const updatedCard = {
        ...card,
        comments: [...card.comments, newComment],
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
      const newAttachment: Attachment = {
        id: uuidv4(),
        name,
        url,
        type,
        createdAt: new Date(),
      };
      
      const updatedCard = {
        ...card,
        attachments: [...card.attachments, newAttachment],
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