import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { z } from 'zod';
import { applyPatch } from 'fast-json-patch';
import type { Operation } from 'fast-json-patch';

// Define a JSON Merge Patch type for boards
// Removed unused MergeBoardPatch type

// JSON Merge Patch schema for board updates
const CardMoveSchema = z.object({
  id: z.string(),
  columnId: z.string().optional(),
  order: z.number().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low','medium','high']).optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  _delete: z.boolean().optional(),
});
const ColumnPatchSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  width: z.number().optional(),
  order: z.number().optional(),
  _delete: z.boolean().optional(),
});
const LabelPatchSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  _delete: z.boolean().optional(),
});
const CommentPatchSchema = z.object({
  id: z.string(),
  content: z.string().optional(),
  _delete: z.boolean().optional(),
});
const AttachmentPatchSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  url: z.string().optional(),
  type: z.string().optional(),
  cardId: z.string(),
  _delete: z.boolean().optional(),
});
const BoardPatchSchema = z.object({
  title: z.string().optional(),
  theme: z.enum(['light','dark']).optional(),
  columns: z.array(ColumnPatchSchema).optional(),
  cards: z.array(CardMoveSchema).optional(),
  labels: z.array(LabelPatchSchema).optional(),
  comments: z.array(CommentPatchSchema).optional(),
  attachments: z.array(AttachmentPatchSchema).optional(),
});

// Input schema for full board shape, used in tests and for merge patch validation
export const BoardInputSchema = z.object({
  id: z.string(),
  title: z.string(),
  theme: z.enum(['light','dark']),
  columns: z.array(z.any()),
});

// DELETE /api/boards/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await dynamic params per Next.js spec
  const { id } = await params;
  try {
    await prisma.board.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(`[API DELETE /api/boards/${id}] Error:`, error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/boards/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await dynamic params per Next.js spec
  const { id: boardId } = await params;
  // Verify board exists
  const existingBoard = await prisma.board.findUnique({ where: { id: boardId } });
  if (!existingBoard) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }
  // Read and parse the raw request body
  const rawBody: unknown = await request.json();
  let mergeObj: unknown;

  if (Array.isArray(rawBody)) {
    // Received JSON Patch array
    const patchOps = rawBody as Operation[];
    // Fetch full board state with nested relations for diff application
    const boardState = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: {
          include: {
            cards: {
              include: {
                labels: true,
                assignees: true,
                attachments: true,
                comments: true,
              },
            },
          },
        },
      },
    });
    if (!boardState) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }
    // Deep clone board state
    const plainDoc = JSON.parse(JSON.stringify(boardState)) as unknown;
    // Apply JSON Patch operations to the cloned state
    const patchResult = applyPatch<unknown>(plainDoc, patchOps);
    if (patchResult.errors && patchResult.errors.length > 0) {
      return NextResponse.json({ error: 'Failed to apply JSON Patch', details: patchResult.errors }, { status: 400 });
    }
    const { newDocument } = patchResult;
    mergeObj = newDocument;
  } else if (typeof rawBody === 'object' && rawBody !== null) {
    // Received JSON Merge Patch object
    mergeObj = rawBody;
  } else {
    return NextResponse.json({ error: 'Invalid patch format' }, { status: 400 });
  }
  // Validate against merged patch schema
  const patch = BoardPatchSchema.parse(mergeObj);
  try {
    const tx = prisma;
    // Board fields
    const boardData: Record<string, unknown> = {};
    if (patch.title !== undefined) boardData.title = patch.title;
    if (patch.theme !== undefined) boardData.theme = patch.theme;
    if (Object.keys(boardData).length) {
      await tx.board.update({ where: { id: boardId }, data: boardData });
    }
    // Columns
    if (patch.columns) {
      for (const col of patch.columns) {
        if (col._delete) {
          await tx.column.delete({ where: { id: col.id } });
        } else {
          const cdata: Record<string, unknown> = {};
          if (col.title !== undefined) cdata.title = col.title;
          if (col.width !== undefined) cdata.width = col.width;
          if (col.order !== undefined) cdata.order = col.order;
          if (Object.keys(cdata).length) {
            await tx.column.update({ where: { id: col.id }, data: cdata });
          }
        }
      }
    }
    // Cards
    if (patch.cards) {
      for (const card of patch.cards) {
        if (card._delete) {
          await tx.card.delete({ where: { id: card.id } });
        } else {
          const cdata: Record<string, unknown> = {};
          if (card.columnId !== undefined) cdata.columnId = card.columnId;
          if (card.order !== undefined) cdata.order = card.order;
          if (card.title !== undefined) cdata.title = card.title;
          if (card.description !== undefined) cdata.description = card.description;
          if (card.dueDate !== undefined) cdata.dueDate = new Date(card.dueDate);
          if (card.priority !== undefined) cdata.priority = card.priority;
          if (card.labels !== undefined) cdata.labels = { set: card.labels.map(id => ({ id })) };
          if (card.assignees !== undefined) cdata.assignees = { set: card.assignees.map(id => ({ id })) };
          if (Object.keys(cdata).length) {
            await tx.card.update({ where: { id: card.id }, data: cdata });
          }
        }
      }
    }
    // Labels
    if (patch.labels) {
      for (const label of patch.labels) {
        if (label._delete) {
          await tx.label.delete({ where: { id: label.id } });
        } else {
          const ldata: Record<string, unknown> = {};
          if (label.name !== undefined) ldata.name = label.name;
          if (label.color !== undefined) ldata.color = label.color;
          await tx.label.upsert({
            where: { id: label.id },
            update: ldata,
            create: { id: label.id, name: label.name ?? '', color: label.color ?? '' }
          });
        }
      }
    }
    // Comments
    if (patch.comments) {
      for (const cm of patch.comments) {
        if (cm._delete) {
          await tx.comment.delete({ where: { id: cm.id } });
        } else if (cm.content !== undefined) {
          await tx.comment.update({ where: { id: cm.id }, data: { content: cm.content } });
        }
      }
    }
    // Attachments
    if (patch.attachments) {
      for (const att of patch.attachments) {
        if (att._delete) {
          await tx.attachment.delete({ where: { id: att.id } });
        } else {
          const adata: Record<string, unknown> = {};
          if (att.name !== undefined) adata.name = att.name;
          if (att.url !== undefined) adata.url = att.url;
          if (att.type !== undefined) adata.type = att.type;
          await tx.attachment.upsert({
            where: { id: att.id },
            update: adata,
            create: { id: att.id, name: att.name ?? '', url: att.url ?? '', type: att.type ?? '', card: { connect: { id: att.cardId } } }
          });
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error(`[API PATCH /api/boards/${boardId}] Merge patch error:`, e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}