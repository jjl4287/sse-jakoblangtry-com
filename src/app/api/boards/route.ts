/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '~/lib/prisma';
import type { Board } from '~/types';
import type { Prisma } from '@prisma/client';

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
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  try {
    const url = new URL(request.url);
    const boardId = url.searchParams.get('boardId');
    if (!boardId) {
      let boards;
      const orderBy: Prisma.BoardOrderByWithRelationInput[] = [
        { pinned: 'desc' },
        { updatedAt: 'desc' },
      ];
      const select = { id: true, title: true, pinned: true };
      // Filter public boards for unauthenticated, or public + user boards if authenticated
      // @ts-ignore: `isPublic` added to model but types not regenerated
      if (!userId) {
        boards = await prisma.board.findMany({ where: { isPublic: true }, orderBy, select });
      } else {
        // @ts-ignore: `isPublic` added to model but types not regenerated
        boards = await prisma.board.findMany({ where: { OR: [{ isPublic: true }, { userId }] }, orderBy, select });
      }
      return NextResponse.json(boards);
    }
    // @ts-expect-error: Prisma include columns/cards types may mismatch generated types
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const userName = session.user.name || 'Anonymous';
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