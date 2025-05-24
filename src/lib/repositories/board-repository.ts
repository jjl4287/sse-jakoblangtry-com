import prisma from '~/lib/prisma';
import type { Board, BoardMembership } from '~/types';
import type { BaseRepository, FindManyOptions } from './base-repository';
import type { Prisma } from '@prisma/client';

type BoardWithRelations = Prisma.BoardGetPayload<{
  include: {
    columns: {
      include: {
        cards: {
          include: {
            labels: true;
            attachments: true;
            comments: { include: { user: true } };
            assignees: true;
          }
        }
      }
    },
    labels: true,
    members: { include: { user: true } }
  }
}>;

export interface BoardRepository extends BaseRepository<Board> {
  findUserBoards(userId: string): Promise<Pick<Board, 'id' | 'title' | 'theme'>[]>;
  findPublicBoards(): Promise<Pick<Board, 'id' | 'title' | 'theme'>[]>;
  findBoardWithAccess(boardId: string, userId?: string): Promise<Board | null>;
  addMember(boardId: string, userId: string, role?: string): Promise<BoardMembership>;
  removeMember(boardId: string, userId: string): Promise<void>;
  updateTheme(boardId: string, theme: 'light' | 'dark'): Promise<Board>;
}

class PrismaBoardRepository implements BoardRepository {
  private mapToBoard(prismaBoard: BoardWithRelations): Board {
    return {
      id: prismaBoard.id,
      title: prismaBoard.title,
      theme: (prismaBoard.theme as 'light' | 'dark') || 'light',
      columns: prismaBoard.columns
        .sort((a, b) => a.order - b.order)
        .map(col => ({
          id: col.id,
          title: col.title,
          width: col.width,
          order: col.order,
          cards: col.cards
            .sort((a, b) => a.order - b.order)
            .map(card => ({
              id: card.id,
              columnId: col.id,
              order: card.order,
              title: card.title,
              description: card.description,
              labels: card.labels.map(l => ({ 
                id: l.id, 
                name: l.name, 
                color: l.color, 
                boardId: l.boardId 
              })),
              assignees: card.assignees.map(u => ({ 
                id: u.id, 
                name: u.name, 
                email: u.email, 
                image: u.image 
              })),
              priority: card.priority as 'low' | 'medium' | 'high',
              weight: card.weight ?? undefined,
              attachments: card.attachments.map(a => ({ 
                id: a.id, 
                name: a.name, 
                url: a.url, 
                type: a.type, 
                createdAt: a.createdAt 
              })),
              comments: card.comments.map(c => ({
                id: c.id,
                content: c.content,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
                cardId: c.cardId,
                userId: c.userId,
                user: {
                  id: c.user.id,
                  name: c.user.name,
                  email: c.user.email,
                  image: c.user.image,
                }
              })),
              dueDate: card.dueDate ?? undefined,
            })),
        })),
      labels: prismaBoard.labels?.map(l => ({ 
        id: l.id, 
        name: l.name, 
        color: l.color, 
        boardId: l.boardId 
      })) ?? [],
      members: prismaBoard.members?.map(m => ({
        id: m.id,
        role: m.role,
        userId: m.userId,
        boardId: m.boardId,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
        }
      })) ?? [],
    };
  }

  async findById(id: string): Promise<Board | null> {
    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            cards: {
              orderBy: { order: 'asc' },
              include: {
                labels: true,
                attachments: true,
                comments: { include: { user: true } },
                assignees: true
              }
            }
          }
        },
        labels: true,
        members: { include: { user: true } }
      }
    });

    return board ? this.mapToBoard(board) : null;
  }

  async findMany(): Promise<Board[]> {
    const boards = await prisma.board.findMany({
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            cards: {
              orderBy: { order: 'asc' },
              include: {
                labels: true,
                attachments: true,
                comments: { include: { user: true } },
                assignees: true
              }
            }
          }
        },
        labels: true,
        members: { include: { user: true } }
      }
    });

    return boards.map(this.mapToBoard);
  }

  async findUserBoards(userId: string): Promise<Pick<Board, 'id' | 'title' | 'theme'>[]> {
    const boards = await prisma.board.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { members: { some: { userId } } }
        ]
      },
      select: { id: true, title: true, theme: true },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }]
    });

    return boards.map(b => ({ 
      id: b.id, 
      title: b.title, 
      theme: (b.theme as 'light' | 'dark') || 'light' 
    }));
  }

  async findPublicBoards(): Promise<Pick<Board, 'id' | 'title' | 'theme'>[]> {
    const boards = await prisma.board.findMany({
      where: { isPublic: true },
      select: { id: true, title: true, theme: true },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }]
    });

    return boards.map(b => ({ 
      id: b.id, 
      title: b.title, 
      theme: (b.theme as 'light' | 'dark') || 'light' 
    }));
  }

  async findBoardWithAccess(boardId: string, userId?: string): Promise<Board | null> {
    const whereCondition: Prisma.BoardWhereInput = {
      id: boardId,
      ...(userId ? {
        OR: [
          { creatorId: userId },
          { members: { some: { userId } } },
          { isPublic: true }
        ]
      } : { isPublic: true })
    };

    const board = await prisma.board.findFirst({
      where: whereCondition,
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            cards: {
              orderBy: { order: 'asc' },
              include: {
                labels: true,
                attachments: true,
                comments: { include: { user: true } },
                assignees: true
              }
            }
          }
        },
        labels: true,
        members: { include: { user: true } }
      }
    });

    return board ? this.mapToBoard(board) : null;
  }

  async create(data: { title: string; creatorId: string; theme?: 'light' | 'dark' }): Promise<Board> {
    const board = await prisma.board.create({
      data: {
        title: data.title,
        creatorId: data.creatorId,
        theme: data.theme || 'light'
      },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            cards: {
              orderBy: { order: 'asc' },
              include: {
                labels: true,
                attachments: true,
                comments: { include: { user: true } },
                assignees: true
              }
            }
          }
        },
        labels: true,
        members: { include: { user: true } }
      }
    });

    return this.mapToBoard(board);
  }

  async update(id: string, data: Partial<{ title: string; theme: 'light' | 'dark' }>): Promise<Board> {
    const board = await prisma.board.update({
      where: { id },
      data,
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            cards: {
              orderBy: { order: 'asc' },
              include: {
                labels: true,
                attachments: true,
                comments: { include: { user: true } },
                assignees: true
              }
            }
          }
        },
        labels: true,
        members: { include: { user: true } }
      }
    });

    return this.mapToBoard(board);
  }

  async delete(id: string): Promise<void> {
    await prisma.board.delete({ where: { id } });
  }

  async addMember(boardId: string, userId: string, role = 'member'): Promise<BoardMembership> {
    const membership = await prisma.boardMembership.create({
      data: { boardId, userId, role },
      include: { user: true }
    });

    return {
      id: membership.id,
      role: membership.role,
      userId: membership.userId,
      boardId: membership.boardId,
      user: {
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        image: membership.user.image,
      }
    };
  }

  async removeMember(boardId: string, userId: string): Promise<void> {
    await prisma.boardMembership.delete({
      where: { boardId_userId: { boardId, userId } }
    });
  }

  async updateTheme(boardId: string, theme: 'light' | 'dark'): Promise<Board> {
    return this.update(boardId, { theme });
  }
}

export const boardRepository: BoardRepository = new PrismaBoardRepository(); 