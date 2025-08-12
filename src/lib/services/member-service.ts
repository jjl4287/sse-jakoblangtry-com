import type { BoardMembership } from '~/types';
import { boardRepository } from '~/lib/repositories/board-repository';
import { NotFoundError, ValidationError } from '~/lib/errors/domain-errors';

export interface MemberService {
  listMembers(boardId: string, requesterId: string): Promise<BoardMembership[]>;
}

export class MemberServiceImpl implements MemberService {
  constructor(private boards = boardRepository) {}

  async listMembers(boardId: string, requesterId: string): Promise<BoardMembership[]> {
    const board = await this.boards.findBoardWithAccess(boardId, requesterId);
    if (!board) {
      throw new NotFoundError('Board', boardId);
    }
    return board.members;
  }
}

export const memberService: MemberService = new MemberServiceImpl();


