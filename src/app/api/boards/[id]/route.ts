import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import type { Board } from '~/types';
import { z } from 'zod';

// Schema for validating incoming Board data on PATCH
const BoardInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  theme: z.enum(['light','dark']),
  columns: z.array(z.object({
    id: z.string(),
    title: z.string(),
    width: z.number(),
    order: z.number(),
    cards: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.enum(['low','medium','high']),
      order: z.number(),
      labels: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })),
      assignees: z.array(z.string())
    }))
  }))
});

export { BoardInputSchema };

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const boardId = params.id;
  // Validate request body
  const rawBody = await request.json();
  const boardData = BoardInputSchema.parse(rawBody);
  console.debug(`[API PATCH /api/boards/${boardId}] syncing columns:`, boardData.columns.map(c => c.id));
  try {
    // Ensure labels exist
    const allLabels = boardData.columns.flatMap(col => col.cards.flatMap(card => card.labels));
    const uniqueLabels = Array.from(new Map(allLabels.map(l => [l.id, l])).values());
    await Promise.all(uniqueLabels.map(label =>
      prisma.label.upsert({ where: { id: label.id }, update: { name: label.name, color: label.color }, create: { id: label.id, name: label.name, color: label.color } })
    ));
    // Ensure users exist
    const allAssignees = boardData.columns.flatMap(col => col.cards.flatMap(card => card.assignees));
    const uniqueAssignees = Array.from(new Set(allAssignees));
    await Promise.all(uniqueAssignees.map(id =>
      prisma.user.upsert({ where: { id }, update: {}, create: { id, name: id } })
    ));
    // Fetch existing board
    const existing = await prisma.board.findUnique({ where: { id: boardId }, include: { columns: { include: { cards: true } } } });
    if (!existing) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }
    // Update board with nested upserts
    await prisma.board.update({
      where: { id: boardId },
      data: {
        theme: boardData.theme,
        columns: {
          deleteMany: { id: { notIn: boardData.columns.map(c => c.id) } },
          upsert: boardData.columns.map(col => ({
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
                    priority: card.priority,
                    order: card.order,
                    labels: { set: card.labels.map(l => ({ id: l.id })) },
                    assignees: { set: card.assignees.map(uId => ({ id: uId })) }
                  },
                  create: {
                    id: card.id,
                    title: card.title,
                    description: card.description || '',
                    dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
                    priority: card.priority,
                    order: card.order,
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
              cards: {
                create: col.cards.map(card => ({
                  id: card.id,
                  title: card.title,
                  description: card.description || '',
                  dueDate: card.dueDate ? new Date(card.dueDate) : undefined,
                  priority: card.priority,
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
    console.error('[API PATCH /api/boards/' + boardId + '] Sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/boards/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    await prisma.board.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[API DELETE /api/boards/${id}] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}