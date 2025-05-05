/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '~/lib/prisma';
import type { Board } from '~/types';
import type { Prisma } from '@prisma/client';

// Typing the raw board payload (with include) as any to bypass TS include restrictions
type ProjectWithRelations = any;

// Helper to convert DB models into Board JSON shape, including members and milestones
const mapToBoard = (project: any): Board => ({
  id: project.id,
  title: project.title,
  theme: project.theme === 'light' ? 'light' : 'dark',
  user: { id: project.user.id, name: project.user.name, email: project.user.email, image: project.user.image },
  userId: project.userId,
  pinned: project.pinned,
  isPublic: project.isPublic,
  members: (project.boardMembers as any[]).map((m: any) => ({ id: m.user.id, name: m.user.name, email: m.user.email, joinedAt: m.createdAt.toISOString() })),
  milestones: project.milestones as any,
  columns: (project.columns as any[]).map((col: any) => ({
    id: col.id,
    title: col.title,
    width: col.width,
    order: col.order,
    cards: (col.cards as any[]).map((card: any) => ({
      id: card.id,
      columnId: col.id,
      order: card.order,
      title: card.title,
      description: card.description,
      labels: (card.labels as any[]).map((l: any) => ({ id: l.id, name: l.name, color: l.color })),
      assignees: (card.assignees as any[]).map((u: any) => ({ id: u.id, name: u.name, email: u.email ?? undefined, image: u.image ?? undefined })),
      priority: card.priority,
      attachments: (card.attachments as any[]).map((a: any) => ({ id: a.id, name: a.name, url: a.url, type: a.type, createdAt: a.createdAt })),
      comments: (card.comments as any[]).map((c: any) => ({ id: c.id, author: c.author, content: c.content, createdAt: c.createdAt })),
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
    if (!boardId) {
      const orderBy: Prisma.BoardOrderByWithRelationInput[] = [
        { pinned: 'desc' },
        { updatedAt: 'desc' },
      ];
      const select = { id: true, title: true, pinned: true };
      // Return public boards for unauthenticated users
      if (!userId) {
        const boards = await prisma.board.findMany({ where: { isPublic: true }, orderBy, select });
        return NextResponse.json(boards);
      }
      // Return public or user-owned boards for authenticated users
      const boards = await prisma.board.findMany({
        where: {
          OR: [
            { isPublic: true },
            { userId },
            { boardMembers: { some: { userId } } }
          ]
        },
        orderBy,
        select
      });
      return NextResponse.json(boards);
    }
    // Fetch board with members and milestones
    const includeData: any = {
      user: true,
      boardMembers: { include: { user: true } },
      milestones: true,
      columns: {
        orderBy: { order: 'asc' },
        include: {
          cards: {
            orderBy: { order: 'asc' },
            include: { labels: true, attachments: true, comments: true, assignees: true },
          },
        },
      },
    };
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { isPublic: true },
          { userId },
          { boardMembers: { some: { userId } } },
        ],
      },
      // @ts-ignore include relations not recognized in BoardInclude type
      include: includeData,
    }) as ProjectWithRelations | null;
    if (!board) {
      return NextResponse.json({ error: 'No board found' }, { status: 404 });
    }
    // Map Board and include members and milestones directly
    const outBoard = mapToBoard(board);
    return NextResponse.json(outBoard);
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