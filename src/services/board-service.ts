import { v4 as uuidv4 } from 'uuid';
import type { Board, Card, Column, Label, Attachment, Comment, Milestone, Group, User } from '~/types';

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
      // Attempt to parse JSON, assuming error structure
      const body = await res.json(); 
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
        errMsg = body.error;
      } else {
        // Fallback if body is not JSON or doesn't have the expected error format
        // THIS BRANCH IS UNLIKELY TO BE REACHED IF .json() ITSELF THROWS
        errMsg = await res.text(); // Get raw text response
      }
    } catch (e) {
      // Handle cases where response is not JSON or body is empty
      console.warn('Could not parse error response body, attempting text() fallback:', e);
      try {
          errMsg = await res.text(); // Try reading text body as fallback
      } catch (textError) {
          console.warn('Could not read text() body, using status text.', textError);
          errMsg = res.statusText || errMsg; // Fallback to statusText if text() also fails
      }
    }
    throw new Error(errMsg);
  }
}

// Fetch a single board by ID, or default to first board if no ID provided
async function fetchBoard(): Promise<Board> {
  const rawParams = typeof window !== 'undefined' ? window.location.search : '';
  const params = rawParams.replace('projectId', 'boardId');
  const url = `${API_ENDPOINT}${params}`;
  let res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch boards list: ${res.status}`);
  }
  // Expect data to be Board or Board[]
  const data: unknown = await res.json();
  // If server returned a list, pick the first and re-fetch
  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error('No boards available');
    const firstBoard = data[0] as Partial<Board>; // Assume it might be a partial board initially
    if (!firstBoard || typeof firstBoard.id !== 'string') { // Validate structure
      throw new Error('First board data is invalid or missing ID'); 
    }
    const firstId = firstBoard.id;
    // Replace URL param for consistency
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      sp.set('boardId', firstId);
      window.history.replaceState({}, '', `?${sp.toString()}`);
    }
    // Fetch the specific board by ID
    const boardRes = await fetch(`${API_ENDPOINT}?boardId=${firstId}`);
    if (!boardRes.ok) throw new Error(`Failed to fetch board: ${boardRes.status}`);
    // Expect the single board fetch to return a Board object
    const boardData: unknown = await boardRes.json();
    // Add validation if needed before casting
    return boardData as Board; 
  }
  // If it wasn't an array, assume it's a single board
  // Add validation if needed before casting
  return data as Board;
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
        const body = await res.json();
        if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
          msg = body.error;
        } else {
          // Fallback unlikely to be reached if json() throws
          msg = await res.text();
        }
      } catch (e) {
        console.warn('Could not parse error response body, attempting text() fallback:', e);
         try {
            msg = await res.text(); // Try reading text body as fallback
        } catch (textError) {
            console.warn('Could not read text() body, using status text.', textError);
            msg = res.statusText || msg; // Fallback to statusText if text() also fails
        }
      }
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
    
    const column = board.columns[index];
    if (!column) {
      throw new ItemNotFoundError('Column', columnId);
    }
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
      if (!column || !column.cards) continue;
      const cardIndex = column.cards.findIndex(card => card?.id === cardId);
      
      if (cardIndex !== -1) {
        const card = column.cards[cardIndex];
        if (!card) {
            console.warn(`Card at index ${cardIndex} was unexpectedly undefined for column ${column.id}`);
            continue;
        }
        return { 
          card,
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
    if (!moved) throw new Error('Failed to splice column for moving');
    columns.splice(newIndex, 0, moved);
    // Persist new orders
    await Promise.all(columns.map((col, idx) => {
      if (!col) return Promise.resolve();
      return fetch(`/api/columns/${col.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: idx }),
      })
    }));
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
        // Ensure column and its cards exist before searching
        if (!col || !col.cards) continue; 
        const cardIndex = col.cards.findIndex(c => c?.id === cardId);
        if (cardIndex !== -1) {
            const foundCard = col.cards[cardIndex];
            // Ensure card was actually found at the index
            if (foundCard) { 
                originalCard = foundCard; // Assign validated card
                originalColumn = col; // Assign validated column
                originalColumnIndex = i;
                originalCardIndex = cardIndex;
                break;
            } else {
                console.warn(`Card at index ${cardIndex} was unexpectedly undefined during duplication search.`);
            }
        }
    }

    if (!originalCard || !originalColumn) {
        throw new ItemNotFoundError('Card', cardId);
    }

    const finalTargetColumnId = targetColumnId ?? originalColumn.id;
    const targetColumnIndex = board.columns.findIndex(col => col?.id === finalTargetColumnId);
    if (targetColumnIndex === -1) {
        throw new ItemNotFoundError('Target column', finalTargetColumnId);
    }

    const targetColumn = board.columns[targetColumnIndex];
    if (!targetColumn) {
        throw new ItemNotFoundError('Target column', finalTargetColumnId);
    }
    
    // Determine the insert index for the new card: after the original card in the same column or at the end of target
    const insertIndex = finalTargetColumnId === originalColumn.id
      ? originalCardIndex + 1
      : targetColumn.cards?.length ?? 0;

    const duplicatedCardData = {
        ...originalCard,
        id: uuidv4(),
        title: `(Copy) ${originalCard.title}`,
        columnId: finalTargetColumnId,
        labels: originalCard.labels?.map(label => ({ ...label, id: uuidv4() })) ?? [],
        attachments: originalCard.attachments?.map(att => ({ ...att, id: uuidv4() })) ?? [],
        comments: originalCard.comments?.map(com => ({ ...com, id: uuidv4() })) ?? [],
        assignees: [...(originalCard.assignees ?? [])],
    };

    const duplicatedCardWithOrder: Card = {
        ...duplicatedCardData,
        order: insertIndex,
    };

    const updatedBoardData = { ...board };
    const updatedColumns = [...updatedBoardData.columns];
    const finalTargetColumn = updatedColumns[targetColumnIndex];

    if (!finalTargetColumn || !finalTargetColumn.cards) {
        throw new Error('Target column or its cards are undefined before duplication update.');
    }

    // Insert the duplicated card into the target column
    const updatedTargetCards = [
        ...finalTargetColumn.cards.slice(0, insertIndex),
        duplicatedCardWithOrder,
        ...finalTargetColumn.cards.slice(insertIndex)
    ].map((card, index) => ({
        ...card,
        order: index
    }));

    updatedColumns[targetColumnIndex] = {
        ...finalTargetColumn,
        cards: updatedTargetCards,
    };

    // If the card was duplicated within the same column, ensure source column is updated
    if (finalTargetColumnId === originalColumn.id) {
         const updatedSourceColumn = updatedColumns[targetColumnIndex];
         if(!updatedSourceColumn) throw new Error('Source column became undefined');
         updatedColumns[originalColumnIndex] = updatedSourceColumn;
    }

    updatedBoardData.columns = updatedColumns;
    await saveBoard(updatedBoardData);
    return updatedBoardData;
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

  /**
   * Deletes a board by ID
   */
  static async deleteBoard(id: string): Promise<void> {
    const res = await fetch(`${API_ENDPOINT}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      let msg = `Delete board failed: ${res.status}`;
      try {
        const body = await res.json();
        if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
          msg = body.error;
        } else {
           msg = await res.text();
        }
      } catch (e) {
        console.warn('Could not parse error response body, using status text:', e);
        msg = res.statusText || msg;
      }
      throw new Error(msg);
    }
  }

  /**
   * Assigns a user to a card
   */
  static async assignUserToCard(cardId: string, userId: string): Promise<Board> {
    // Fetch current board first (so tests can stub this call)
    await this.getBoard();
    // Simply send the single userId as an array for assignees
    const res = await fetch(`/api/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignees: [userId] }),
    });
    if (!res.ok) {
      let errorMsg = `Failed to assign user: ${res.statusText}`;
      try {
        const body = await res.json();
        if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
          errorMsg = body.error;
        } else {
          errorMsg = await res.text();
        }
      } catch (e) {
         console.warn('Could not parse assignUser error response body', e);
         errorMsg = res.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }
    // Return updated board context
    return await this.getBoard();
  }

  /**
   * Sets the milestone for a card
   */
  static async setCardMilestone(cardId: string, milestoneId: string): Promise<Board> {
    const res = await fetch(`/api/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneId }),
    });
    if (!res.ok) {
      let errorMsg = `Failed to set milestone: ${res.statusText}`;
      try {
        const body = await res.json();
        if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
          errorMsg = body.error;
        } else {
          errorMsg = await res.text();
        }
      } catch (e) {
        console.warn('Could not parse setCardMilestone error response body', e);
        errorMsg = res.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }
    return await this.getBoard();
  }

  /**
   * Invites a user to a board
   */
  static async inviteUserToBoard(boardId: string, email: string): Promise<Board> {
    const res = await fetch(`/api/boards/${boardId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      let errorMsg = `Failed to invite user: ${res.statusText}`;
      try {
        const body = await res.json();
        if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
          errorMsg = body.error;
        } else {
          errorMsg = await res.text();
        }
      } catch (e) {
        console.warn('Could not parse inviteUserToBoard error response body', e);
        errorMsg = res.statusText || errorMsg;
      }
      throw new Error(errorMsg);
    }
    return await this.getBoard();
  }

  /**
   * Creates a new group
   */
  static async createGroup(name: string): Promise<Group> {
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      let errorMsg = `Failed to create group: ${res.statusText}`;
      try {
        const body = await res.json();
        if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
          errorMsg = body.error;
        }
      } catch (e) {
        console.warn('Could not parse createGroup error response body', e);
        errorMsg = res.statusText || errorMsg;
        throw new Error(errorMsg);
      }
      throw new Error(errorMsg);
    }
    return await res.json() as Group;
  }

  /**
   * Adds a user to a group
   */
  static async addUserToGroup(groupId: string, userId: string): Promise<Group> {
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      let errorMsg = `Failed to add user to group: ${res.statusText}`;
      try {
        const body = await res.json();
        if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
          errorMsg = body.error;
        }
      } catch (e) {
        console.warn('Could not parse addUserToGroup error response body', e);
        errorMsg = res.statusText || errorMsg;
        throw new Error(errorMsg);
      }
      throw new Error(errorMsg);
    }
    return await res.json() as Group;
  }

  /**
   * Shares a board with a group
   */
  static async shareBoardWithGroup(boardId: string, groupId: string): Promise<Board> {
    const res = await fetch(`/api/boards/${boardId}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId }),
    });
    if (!res.ok) {
      let errorMsg = `Failed to share board with group: ${res.statusText}`;
      try {
        const body = await res.json();
        if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
          errorMsg = body.error;
        }
      } catch (e) {
         console.warn('Could not parse shareBoardWithGroup error response body', e);
         errorMsg = res.statusText || errorMsg;
         throw new Error(errorMsg);
      }
      throw new Error(errorMsg);
    }
    return await this.getBoard();
  }

  /**
   * Lists all members of a board
   */
  static async listBoardMembers(boardId: string): Promise<{ id: string; name: string; email?: string; joinedAt: string }[]> {
    const res = await fetch(`${API_ENDPOINT}/${boardId}/members`);
    if (!res.ok) {
      let errMsg = `Failed to list board members: ${res.statusText}`;
      throw new Error(errMsg);
    }
    return await res.json();
  }

  /**
   * Lists all groups shared with a board
   */
  static async listBoardGroups(boardId: string): Promise<{ id: string; name: string; createdAt: string; updatedAt: string }[]> {
    const res = await fetch(`${API_ENDPOINT}/${boardId}/groups`);
    if (!res.ok) {
      let errMsg = `Failed to list board groups: ${res.statusText}`;
      throw new Error(errMsg);
    }
    return await res.json();
  }

  /**
   * Lists all groups the current user is a member of
   */
  static async listGroups(): Promise<Group[]> {
    const res = await fetch(`/api/groups`);
    if (!res.ok) {
      let errMsg = `Failed to list groups: ${res.statusText}`;
      throw new Error(errMsg);
    }
    return await res.json() as Promise<Group[]>;
  }

  /**
   * Current user joins a board
   */
  static async joinBoard(boardId: string): Promise<Board> {
    const res = await fetch(`${API_ENDPOINT}/${boardId}/join`, { method: 'POST' });
    if (!res.ok) {
      let errMsg = `Failed to join board: ${res.statusText}`;
      try {
        const body = await res.json();
        if (typeof body === 'object' && body !== null && 'error' in body && typeof (body as any).error === 'string') {
          errMsg = (body as any).error;
        }
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }
    return await this.getBoard();
  }
} 