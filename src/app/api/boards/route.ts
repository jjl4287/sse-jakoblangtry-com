/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma';
import type { Board, Label as BoardLabelType, BoardMembership, User as UserType } from '~/types';
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
      const boards = await prisma.board.findMany({ 
        where: whereClause, 
        orderBy,
        select: { id: true, title: true, pinned: true, theme: true, creatorId: true, isPublic: true, updatedAt: true }
      });
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

    const board = await prisma.board.findFirst({
      where: boardWhereConditions,
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
        labels: {
          select: {
            id: true,
            name: true,
            color: true,
            boardId: true
          }
        }, 
        members: { include: { user: true } } 
      }
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found or access denied' }, { status: 404 });
    }
    
    const out = mapToBoard(board);
    return NextResponse.json(out);

  } catch (error: unknown) {
    console.error('[API GET /api/boards] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
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

  // Ensure the user exists (upsert) before creating the board
  await prisma.user.upsert({
    where: { id: userId },
    create: { 
      id: userId, 
      name: userName,
      email: email,
    },
    update: { 
      name: userName,
      email: email,
    },
  });

  // Now create the board linked to that user
  const newBoard = await prisma.board.create({
    data: {
      title,
      creatorId: userId,
      members: {
        create: [
          {
            userId: userId,
            role: 'owner',
          },
        ],
      },
    },
    include: {
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  return NextResponse.json(
    { id: newBoard.id, title: newBoard.title, pinned: newBoard.pinned, creatorId: newBoard.creatorId }, 
    { status: 201 }
  );
} 