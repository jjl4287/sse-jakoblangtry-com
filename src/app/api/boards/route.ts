import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import { boardService } from '~/lib/services/board-service';
import { jsonError } from '~/lib/api/response';
import type { Board } from '~/types';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

// Define typed payload for board with nested relations
type ProjectWithRelations = Prisma.BoardGetPayload<{
  include: {
    columns: {
      orderBy: { order: 'asc' },
      include: {
        cards: {
          orderBy: { order: 'asc' },
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

// Helper to convert DB models into Board JSON shape
// Include id and title so frontend can PATCH the correct board
const mapToBoard = (project: ProjectWithRelations): Board => ({
  id: project.id,
  title: project.title,
  theme: project.theme === 'light' ? 'light' : 'dark',
  columns: project.columns.map(col => ({
    id: col.id,
    title: col.title,
    width: col.width,
    order: col.order,
    cards: col.cards.map(card => ({
      id: card.id,
      columnId: col.id,
      order: card.order,
      title: card.title,
      description: card.description,
      labels: card.labels.map(l => ({ id: l.id, name: l.name, color: l.color, boardId: l.boardId })),
      assignees: card.assignees.map(u => ({ id: u.id, name: u.name, email: u.email, image: u.image })),
      priority: card.priority,
      weight: card.weight ?? undefined,
      attachments: card.attachments.map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type, createdAt: a.createdAt })),
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
  labels: project.labels?.map(l => ({ id: l.id, name: l.name, color: l.color, boardId: l.boardId })) ?? [],
  members: project.members?.map(m => ({
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
});

// Force this API route to always be dynamic (no caching)
export const dynamic = 'force-dynamic';

/**
 * GET handler to retrieve the board data.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  try {
    const url = new URL(request.url);
    const boardId = url.searchParams.get('boardId');

    // ---- LISTING BOARDS ----
    if (!boardId) {
      const orderBy: Prisma.BoardOrderByWithRelationInput[] = [
        { pinned: 'desc' },
        { updatedAt: 'desc' },
      ];
      // No specific select for list, rely on default fields or define minimally if needed

      let whereClause: Prisma.BoardWhereInput = { isPublic: true };

      if (userId) {
        whereClause = {
          OR: [
            { isPublic: true }, 
            { creatorId: userId },
            { members: { some: { userId: userId } } }
          ]
        };
      }      
      // Delegate to service/repository via existing service method
      const boards = userId ? await boardService.getUserBoards(userId) : await boardService.getPublicBoards();
      return NextResponse.json(boards);
    }

    // ---- FETCHING A SINGLE BOARD by boardId ----
    let boardWhereConditions: Prisma.BoardWhereInput = { id: boardId };

    if (userId) {
      boardWhereConditions = {
        AND: [
          { id: boardId },
          {
            OR: [
              { creatorId: userId },
              { members: { some: { userId: userId } } },
              { isPublic: true }
            ]
          }
        ]
      };
    } else {
      boardWhereConditions = {
        AND: [
          { id: boardId },
          { isPublic: true }
        ]
      };
    }

    const board = await boardService.getBoardById(boardId, userId || undefined);

    if (!board) {
      return NextResponse.json({ error: 'Board not found or access denied' }, { status: 404 });
    }
    
    const out = mapToBoard(board);
    return NextResponse.json(out);

  } catch (error: unknown) {
    return jsonError(error);
  }
}

const BoardCreateSchema = z.object({ title: z.string().min(1, 'Title is required') });

/**
 * POST handler to create a new board
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const userName = session.user.name ?? 'Anonymous';
  const email = session.user.email;

  const parsed = BoardCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
  }
  const { title } = parsed.data;

  const newBoard = await boardService.createBoard(title, userId);
  return NextResponse.json(
    { id: newBoard.id, title: newBoard.title, pinned: false, creatorId: userId },
    { status: 201 }
  );
} 