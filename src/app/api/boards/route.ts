import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import type { Board } from '~/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
// Helper to convert DB models into Board JSON shape
// Include id and title so frontend can PATCH the correct board
const mapToBoard = (project: any): Board => ({
  id: project.id,
  title: project.title,
  theme: (project.theme as 'light' | 'dark') || 'dark',
  columns: project.columns.map((col: any) => ({
    id: col.id,
    title: col.title,
    width: col.width,
    order: col.order,
    cards: col.cards.map((card: any) => ({
      id: card.id,
      columnId: col.id,
      order: card.order,
      title: card.title,
      description: card.description,
      labels: card.labels.map((l: any) => ({ id: l.id, name: l.name, color: l.color })),
      assignees: card.assignees.map((u: any) => u.id),
      priority: card.priority,
      attachments: card.attachments.map((a: any) => ({ id: a.id, name: a.name, url: a.url, type: a.type })),
      comments: card.comments.map((c: any) => ({ id: c.id, author: c.author, content: c.content })),
      dueDate: card.dueDate ? card.dueDate.toISOString() : null
    }))
  }))
});

// Force this API route to always be dynamic (no caching)
export const dynamic = 'force-dynamic';

/**
 * GET handler to retrieve the board data.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const boardId = url.searchParams.get('boardId');
    if (!boardId) {
      // @ts-ignore: Prisma select/pinned ordering and orderBy pinned may mismatch generated types
      const boards = await prisma.board.findMany({
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        select: { id: true, title: true, pinned: true }
      });
      return NextResponse.json(boards);
    }
    // @ts-ignore: Prisma include columns/cards types may mismatch generated types
    const board = await prisma.board.findUnique({
      where: { id: boardId },
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
      return NextResponse.json({ error: 'No board found' }, { status: 404 });
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
  try {
    const { title } = await request.json();
    const adminId = 'admin';
    // @ts-ignore: Prisma create data types may mismatch generated types
    const board = await prisma.board.create({ data: { title, userId: adminId } });
    return NextResponse.json(board, { status: 201 });
  } catch (error: any) {
    console.error('[API POST /api/boards] Creation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 