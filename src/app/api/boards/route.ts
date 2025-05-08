/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '~/lib/prisma';
import type { Board } from '~/types';
import type { Prisma } from '@prisma/client';

// Define typed payload for board with nested relations
type ProjectWithRelations = Prisma.BoardGetPayload<{
  include: {
    columns: {
      orderBy: { order: 'asc' },
      include: {
        cards: {
          orderBy: { order: 'asc' },
          include: { labels: true; attachments: true; comments: true; assignees: true }
        }
      }
    }
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
      labels: card.labels.map(l => ({ id: l.id, name: l.name, color: l.color })),
      assignees: card.assignees.map(u => u.id),
      priority: card.priority,
      attachments: card.attachments.map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type, createdAt: a.createdAt })),
      comments: card.comments.map(c => ({ id: c.id, author: c.author, content: c.content, createdAt: c.createdAt })),
      dueDate: card.dueDate ?? undefined,
    })),
  })),
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
      const select = { id: true, title: true, pinned: true, userId: true };

      let whereClause: Prisma.BoardWhereInput = { isPublic: true }; // Default for unauthenticated

      if (userId) { // Authenticated user: public boards, owned boards, or shared boards
        whereClause = {
          OR: [
            { isPublic: true }, 
            { userId: userId }, 
            { members: { some: { userId: userId } } }
          ]
        };
      }
      
      const boards = await prisma.board.findMany({ 
        where: whereClause, 
        orderBy, 
        select 
      });
      return NextResponse.json(boards);
    }

    // ---- FETCHING A SINGLE BOARD by boardId ----
    let boardWhereConditions: Prisma.BoardWhereInput = { id: boardId };

    if (userId) { // Authenticated user: must be owner, member, or public
      boardWhereConditions = {
        AND: [
          { id: boardId },
          {
            OR: [
              { userId: userId },
              { members: { some: { userId: userId } } },
              { isPublic: true }
            ]
          }
        ]
      };
    } else { // Unauthenticated user: must be public
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
              include: { labels: true, attachments: true, comments: true, assignees: true }
            }
          }
        }
      }
    });

    if (!board) {
      return NextResponse.json({ error: 'Board not found or access denied' }, { status: 404 });
    }
    
    const out = mapToBoard(board);
    return NextResponse.json(out);

  } catch (error: any) {
    console.error('[API GET /api/boards] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
  const { title } = await request.json();
  // Ensure the user exists (upsert) before creating the board
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, name: userName },
    update: { name: userName },
  });
  // Now create the board linked to that user
  const board = await prisma.board.create({
    data: { title, userId },
  });
  return NextResponse.json(board, { status: 201 });
} 