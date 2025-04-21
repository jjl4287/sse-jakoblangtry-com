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

// Cache the board data for 60 seconds before revalidating
export const revalidate = 60;

/**
 * GET handler to retrieve the board data.
 */
export async function GET() {
  try {
    const project = await prisma.project.findFirst({
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
    // Ensure Label models exist
    const allLabels = board.columns.flatMap(col => col.cards.flatMap(card => card.labels));
    const uniqueLabels = Array.from(new Map(allLabels.map(l => [l.id, l])).values());
    await Promise.all(uniqueLabels.map(label =>
      prisma.label.upsert({
        where: { id: label.id },
        update: { name: label.name, color: label.color },
        create: { id: label.id, name: label.name, color: label.color }
      })
    ));
    // Ensure User models exist for assignees
    const allAssignees = board.columns.flatMap(col => col.cards.flatMap(card => card.assignees));
    const uniqueAssignees = Array.from(new Set(allAssignees));
    await Promise.all(uniqueAssignees.map(id =>
      prisma.user.upsert({
        where: { id },
        update: {},
        create: { id, name: id }
      })
    ));
    // Perform diff-based nested upserts for columns and cards
    const project = await prisma.project.findFirst({ include: { columns: { include: { cards: true } } } });
    if (!project) {
      return NextResponse.json({ error: 'No project found' }, { status: 404 });
    }
    await prisma.project.update({
      where: { id: project.id },
      data: {
        theme: board.theme,
        columns: {
          deleteMany: { id: { notIn: board.columns.map(col => col.id) } },
          upsert: board.columns.map(col => ({
            where: { id: col.id },
            update: {
              title: col.title,
              width: col.width,
              order: col.order,
              cards: {
                deleteMany: { id: { notIn: col.cards.map(card => card.id) } },
                upsert: col.cards.map(card => ({
                  where: { id: card.id },
                  update: {
                    title: card.title,
                    description: card.description || '',
                    dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
                    priority: card.priority as any,
                    order: card.order,
                    // Sync labels and assignees relations
                    labels: { set: card.labels.map(l => ({ id: l.id })) },
                    assignees: { set: card.assignees.map(uId => ({ id: uId })) }
                  },
                  create: {
                    id: card.id,
                    title: card.title,
                    description: card.description || '',
                    dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
                    priority: card.priority as any,
                    order: card.order,
                    column: { connect: { id: col.id } },
                    labels: { connect: card.labels.map(l => ({ id: l.id })) },
                    assignees: { connect: card.assignees.map(uId => ({ id: uId })) }
                  }
                }))
              }
            },
            create: {
              id: col.id,
              title: col.title,
              width: col.width,
              order: col.order,
              project: { connect: { id: project.id } },
              cards: {
                create: col.cards.map(card => ({
                  id: card.id,
                  title: card.title,
                  description: card.description || '',
                  dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
                  priority: card.priority as any,
                  order: card.order,
                  labels: { connect: card.labels.map(l => ({ id: l.id })) },
                  assignees: { connect: card.assignees.map(uId => ({ id: uId })) }
                }))
              }
            }
          }))
        }
      }
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API POST /api/boards] Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 