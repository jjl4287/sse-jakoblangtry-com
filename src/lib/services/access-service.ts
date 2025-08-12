import prisma from '~/lib/prisma';

export interface AccessService {
  canAccessBoard(userId: string, boardId: string): Promise<boolean>;
  canManageBoard(userId: string, boardId: string): Promise<boolean>;
  canAccessCard(userId: string, cardId: string): Promise<boolean>;
}

class AccessServiceImpl implements AccessService {
  async canAccessBoard(userId: string, boardId: string): Promise<boolean> {
    if (!userId) return false;
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { creatorId: userId },
          { members: { some: { userId } } },
          { isPublic: true },
        ],
      },
      select: { id: true },
    });
    return !!board;
  }

  async canManageBoard(userId: string, boardId: string): Promise<boolean> {
    if (!userId) return false;
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { creatorId: true },
    });
    return board?.creatorId === userId;
  }

  async canAccessCard(userId: string, cardId: string): Promise<boolean> {
    if (!userId) return false;
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        column: {
          select: {
            board: {
              select: {
                creatorId: true,
                members: { select: { userId: true } },
                isPublic: true,
              },
            },
          },
        },
      },
    });
    if (!card) return false;
    const board = card.column.board;
    return board.creatorId === userId || board.isPublic || board.members.some((m) => m.userId === userId);
  }
}

export const accessService: AccessService = new AccessServiceImpl();


