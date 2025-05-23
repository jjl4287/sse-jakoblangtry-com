import type { Board } from '~/types';
import { boardRepository } from '~/lib/repositories/board-repository';

export interface BoardService {
  getUserBoards(userId: string): Promise<Pick<Board, 'id' | 'title' | 'theme'>[]>;
  getPublicBoards(): Promise<Pick<Board, 'id' | 'title' | 'theme'>[]>;
  getBoardById(boardId: string, userId?: string): Promise<Board | null>;
  createBoard(title: string, creatorId: string): Promise<Board>;
  updateBoard(boardId: string, updates: Partial<{ title: string; theme: 'light' | 'dark' }>): Promise<Board>;
  deleteBoard(boardId: string, userId: string): Promise<void>;
  shareBoard(boardId: string, targetUserId: string, userId: string): Promise<void>;
  unshareBoard(boardId: string, targetUserId: string, userId: string): Promise<void>;
}

export class BoardServiceImpl implements BoardService {
  constructor(private repository = boardRepository) {}

  async getUserBoards(userId: string): Promise<Pick<Board, 'id' | 'title' | 'theme'>[]> {
    return this.repository.findUserBoards(userId);
  }

  async getPublicBoards(): Promise<Pick<Board, 'id' | 'title' | 'theme'>[]> {
    return this.repository.findPublicBoards();
  }

  async getBoardById(boardId: string, userId?: string): Promise<Board | null> {
    return this.repository.findBoardWithAccess(boardId, userId);
  }

  async createBoard(title: string, creatorId: string): Promise<Board> {
    if (!title.trim()) {
      throw new Error('Board title cannot be empty');
    }
    
    return this.repository.create({ title: title.trim(), creatorId });
  }

  async updateBoard(boardId: string, updates: Partial<{ title: string; theme: 'light' | 'dark' }>): Promise<Board> {
    const board = await this.repository.findById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    if (updates.title !== undefined && !updates.title.trim()) {
      throw new Error('Board title cannot be empty');
    }

    const sanitizedUpdates = {
      ...(updates.title && { title: updates.title.trim() }),
      ...(updates.theme && { theme: updates.theme })
    };

    return this.repository.update(boardId, sanitizedUpdates);
  }

  async deleteBoard(boardId: string, userId: string): Promise<void> {
    const board = await this.repository.findById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    // Business rule: Only board creator can delete the board
    const isCreator = board.members.some(m => m.userId === userId && m.role === 'owner') ||
                     // Fallback: Check if this is the creator (if no explicit owner role)
                     board.members.some(m => m.userId === userId);
    
    if (!isCreator) {
      throw new Error('Only the board creator can delete this board');
    }

    await this.repository.delete(boardId);
  }

  async shareBoard(boardId: string, targetUserId: string, userId: string): Promise<void> {
    const board = await this.repository.findById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    // Business rule: Only board creator can share
    const isCreator = board.members.some(m => m.userId === userId && m.role === 'owner') ||
                     board.members.some(m => m.userId === userId);
    
    if (!isCreator) {
      throw new Error('Only the board creator can share this board');
    }

    // Business rule: Cannot share with existing member
    const isAlreadyMember = board.members.some(m => m.userId === targetUserId);
    if (isAlreadyMember) {
      throw new Error('User is already a member of this board');
    }

    await this.repository.addMember(boardId, targetUserId);
  }

  async unshareBoard(boardId: string, targetUserId: string, userId: string): Promise<void> {
    const board = await this.repository.findById(boardId);
    if (!board) {
      throw new Error('Board not found');
    }

    // Business rule: Only board creator can unshare
    const isCreator = board.members.some(m => m.userId === userId && m.role === 'owner');
    if (!isCreator) {
      throw new Error('Only the board creator can remove members');
    }

    await this.repository.removeMember(boardId, targetUserId);
  }
}

// Export singleton instance
export const boardService: BoardService = new BoardServiceImpl(); 