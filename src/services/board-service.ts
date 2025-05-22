import { v4 as uuidv4 } from 'uuid';
import type { Board, Card, Column, Label, Attachment, Comment, ActivityLog as ActivityLogType } from '~/types';

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
  // Use PATCH to update an existing board
  const res = await fetch(`${API_ENDPOINT}/${boardData.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(boardData),
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) errMsg = body.error;
    } catch {}
    throw new Error(errMsg);
  }
}

// Fetch a single board by ID, or default to first board if no ID provided
async function fetchBoard(): Promise<Board> {
  // Determine boardId from URL search or path (for app router /boards/[boardId])
  let boardIdParam = '';
  if (typeof window !== 'undefined') {
    const search = window.location.search;
    const sp = new URLSearchParams(search.replace('projectId', 'boardId'));
    boardIdParam = sp.get('boardId') || '';
    // If no search param, try to extract from pathname (/boards/:boardId)
    if (!boardIdParam) {
      const match = /\/boards\/([^\/]+)/.exec(window.location.pathname);
      boardIdParam = match ? match[1] : '';
    }
  }
  const paramString = boardIdParam ? `?boardId=${boardIdParam}` : '';
  const url = `${API_ENDPOINT}${paramString}`;
  let res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch boards list: ${res.status}`);
  }
  const data = await res.json();
  // If server returned a list, pick the first and re-fetch
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error('No boards available');
    const firstId = data[0].id;
    // If path-based boardId wasn't set, update URL to use first board
    if (typeof window !== 'undefined' && !boardIdParam) {
      const sp = new URLSearchParams();
      sp.set('boardId', firstId);
      window.history.replaceState({}, '', `?${sp.toString()}`);
    }
    res = await fetch(`${API_ENDPOINT}?boardId=${firstId}`);
    if (!res.ok) throw new Error(`Failed to fetch board: ${res.status}`);
    return res.json();
  }
  return data as Board;
}

// Define a more specific type for card updates, aligning with API expectations
type CardUpdatePayload = Partial<
  Omit<Card, 'id' | 'columnId' | 'order' | 'labels' | 'assignees' | 'comments' | 'attachments'>
  & {
    labelIdsToAdd?: string[];
    labelIdsToRemove?: string[];
    assigneeIdsToAdd?: string[];
    assigneeIdsToRemove?: string[];
    // Include other direct fields from Card that might be updated if not in Omit
    title?: string;
    description?: string;
    priority?: Card['priority']; // Use Card['priority'] to ensure it matches the type
    dueDate?: Date;
    weight?: number;
  }
>;

// BoardService for managing the kanban board data
export class BoardService {
  /**
   * Gets the current board data
   */
  static async getBoard(): Promise<Board> {
    return await fetchBoard();
  }

  /**
   * Lists all boards (id, title, pinned)
   */
  static async listBoards(): Promise<{ id: string; title: string; pinned: boolean }[]> {
    const res = await fetch(API_ENDPOINT);
    if (!res.ok) {
      throw new Error(`Failed to list boards: ${res.status}`);
    }
    // Cast the JSON to the expected type
    const data = (await res.json()) as { id: string; title: string; pinned: boolean }[];
    return data;
  }

  /**
   * Creates a new board
   */
  static async createBoard(title: string): Promise<{ id: string; title: string; pinned: boolean }> {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      let msg = `Failed to create board: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {}
      throw new Error(msg);
    }
    // Cast the JSON to the expected type
    const newBoard = (await res.json()) as { id: string; title: string; pinned: boolean };
    return newBoard;
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
    const column = board.columns[index]!;
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
      const column = board.columns[i]!;
      const cardIndex = column.cards.findIndex(card => card.id === cardId);
      
      if (cardIndex !== -1) {
        return { 
          card: column.cards[cardIndex]!, 
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
    // include projectId from URL so column is created in the correct project
    const params = typeof window !== 'undefined' ? window.location.search : '';
    const res = await fetch(`/api/columns${params}`, {
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
    // Use a more specific type for cardData, including optional labelIds and assigneeIds
    cardData: Partial<Omit<Card, 'id' | 'columnId' | 'order' | 'comments' | 'attachments'>> & {
      title: string; // Title is non-optional for creation
      labelIds?: string[];
      assigneeIds?: string[];
      weight?: number;
    }
  ): Promise<Board> {
    const params = typeof window !== 'undefined' ? window.location.search : '';
    const res = await fetch(`/api/cards${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Ensure columnId is part of the body, along with other cardData
      body: JSON.stringify({ ...cardData, columnId }),
    });
    if (!res.ok) {
      let msg = `Failed to create card: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {}
      throw new BoardServiceError(msg);
    }
    return await this.getBoard(); // Re-fetch board to get updated state with new card
  }

  /**
   * Updates a card
   */
  static async updateCard(
    cardId: string,
    updates: CardUpdatePayload
  ): Promise<Card> {
    const res = await fetch(`/api/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      let errMsg = `Failed to update card ${cardId}: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) errMsg = body.error;
      } catch {}
      throw new BoardServiceError(errMsg);
    }
    // The API returns the updated card, but BoardService typically refetches the whole board.
    // For now, we'll stick to refetching the board to ensure UI consistency.
    // Potentially optimize later if this becomes a bottleneck.
    return await res.json() as Card;
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
        const col = board.columns[i]!;
        const cardIndex = col.cards.findIndex(c => c.id === cardId);
        if (cardIndex !== -1) {
            originalCard = col.cards[cardIndex]!;
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

    const targetColumn = board.columns[targetColumnIndex]!;
    
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

    const updatedBoard = { ...board, columns: [...board.columns] };

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
         updatedBoard.columns[originalColumnIndex] = updatedBoard.columns[targetColumnIndex]!;
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
        boardId: board.id,
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
      if (!card?.comments) return column;
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
  static async addAttachment(cardId: string, file: File): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/api/cards/${cardId}/attachments`, {
      method: 'POST',
      body: formData, // No 'Content-Type' header needed, browser sets it for FormData
    });

    if (!res.ok) {
      let msg = `Failed to add attachment: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {}
      throw new BoardServiceError(msg);
    }
    return (await res.json()) as Attachment;
  }

  static async listAttachments(cardId: string): Promise<Attachment[]> {
    const res = await fetch(`/api/cards/${cardId}/attachments`);
    if (!res.ok) {
      throw new BoardServiceError(`Failed to list attachments: ${res.status}`);
    }
    return (await res.json()) as Attachment[];
  }

  static async deleteAttachment(cardId: string, attachmentId: string): Promise<void> {
    const res = await fetch(`/api/cards/${cardId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      let msg = `Delete attachment failed: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {}
      throw new BoardServiceError(msg);
    }
    // No specific data returned on successful DELETE, so no need to parse res.json()
    // Depending on how UI is updated, may need to refetch board or card details
  }

  /**
   * Deletes a board by ID
   */
  static async deleteBoard(id: string): Promise<void> {
    const res = await fetch(`${API_ENDPOINT}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      let msg = `Delete board failed: ${res.status}`;
      try {
        const body = await res.json();
        if (body.error) msg = body.error;
      } catch {}
      throw new Error(msg);
    }
  }

  /**
   * Creates a new label for a specific board.
   */
  static async createBoardLabel(boardId: string, name: string, color: string): Promise<Label> {
    const res = await fetch(`/api/boards/${boardId}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      let msg = `Failed to create label: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {}
      throw new BoardServiceError(msg);
    }
    return (await res.json()) as Label;
  }

  /**
   * Updates an existing label for a specific board.
   */
  static async updateBoardLabel(boardId: string, labelId: string, name: string, color: string): Promise<Label> {
    const res = await fetch(`/api/boards/${boardId}/labels/${labelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      let msg = `Failed to update label ${labelId}: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {}
      throw new BoardServiceError(msg);
    }
    return (await res.json()) as Label;
  }

  /**
   * Deletes a label from a specific board.
   */
  static async deleteBoardLabel(boardId: string, labelId: string): Promise<void> {
    const res = await fetch(`/api/boards/${boardId}/labels/${labelId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      let msg = `Failed to delete label ${labelId}: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {}
      throw new BoardServiceError(msg);
    }
    // DELETE typically returns 204 No Content or a success message
    // If it returns JSON with a message, it can be logged, but function signature is void
  }

  /**
   * Fetches comments for a specific card.
   */
  static async fetchComments(cardId: string): Promise<Comment[]> {
    const res = await fetch(`/api/cards/${cardId}/comments`);
    if (!res.ok) {
      let msg = `Failed to fetch comments for card ${cardId}: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {}
      throw new BoardServiceError(msg);
    }
    return (await res.json()) as Comment[];
  }

  /**
   * Creates a new comment for a specific card via API.
   */
  static async createCommentViaApi(cardId: string, content: string): Promise<Comment> {
    const res = await fetch(`/api/cards/${cardId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      let msg = `Failed to create comment for card ${cardId}: ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch {}
      throw new BoardServiceError(msg);
    }
    return (await res.json()) as Comment;
  }

  /**
   * Fetches activity logs for a given card.
   */
  static async fetchActivityLogs(cardId: string): Promise<ActivityLogType[]> {
    const res = await fetch(`/api/cards/${cardId}/activity`);
    if (!res.ok) {
      let errMsg = `Failed to fetch activity logs for card ${cardId}: HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body.error) errMsg = body.error;
      } catch {}
      throw new BoardServiceError(errMsg);
    }
    return (await res.json()) as ActivityLogType[];
  }
} 