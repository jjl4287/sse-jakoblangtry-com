import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import type { Board } from '~/types';

// Helper to convert DB models into Board JSON shape
const mapToBoard = (project: any): Board => ({
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

/**
 * GET handler to retrieve the board data.
 */
export async function GET() {
  try {
    const project = await prisma.project.findFirst({
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: { cards: { include: { labels: true, attachments: true, comments: true, assignees: true } } }
        }
      }
    });
    if (!project) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 });
    }
    const board = mapToBoard(project);
    return NextResponse.json(board);
  } catch (error: any) {
    console.error('[API GET /api/boards] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST handler to update the board data.
 */
export async function POST(request: Request) {
  const board: Board = await request.json();
  console.log('[API POST /api/boards] syncing columns:', board.columns.map(c => c.id));
  try {
    // Get or create the default project
    let project = await prisma.project.findFirst();
    if (!project) {
      project = await prisma.project.create({ data: { title: 'Default Project', theme: board.theme } });
    } else {
      await prisma.project.update({ where: { id: project.id }, data: { theme: board.theme } });
    }
    // Remove existing columns (and cascade deletes cards)
    await prisma.column.deleteMany({ where: { projectId: project.id } });
    // Recreate columns and cards
    for (const col of board.columns) {
      const createdColumn = await prisma.column.create({
        data: {
          id: col.id,
          title: col.title,
          width: col.width,
          order: col.order,
          projectId: project.id,
          cards: {
            create: col.cards.map(card => ({
              id: card.id,
              title: card.title,
              description: card.description || '',
              dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
              priority: card.priority as any,
              order: card.order,
              attachments: { create: card.attachments.map(a => ({ name: a.name, url: a.url, type: a.type })) },
              comments: { create: card.comments.map(c => ({ author: c.author, content: c.content })) }
            }))
          }
        }
      });
      // Note: labels and assignees mapping omitted for now
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API POST /api/boards] Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 