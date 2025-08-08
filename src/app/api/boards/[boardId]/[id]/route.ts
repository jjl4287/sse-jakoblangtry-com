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
  { params }: { params: { id: string } }
) {
  const { id } = params;
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
  { params }: { params: { id: string } }
) {
  const { id: boardId } = params;
  // Verify board exists
  const existingBoard = await prisma.board.findUnique({ where: { id: boardId } });
  if (!existingBoard) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body: Expected JSON' }, { status: 400 });
  }

  try {
    let mergeObj: unknown;

    // Prepare operations for a unified transaction
    let isJsonPatch = false;
    let jsonPatchBoardData: Record<string, unknown> = {};
    let jsonPatchColumnsToDelete: string[] = [];
    let mergeBoardUpdateData: Record<string, unknown> = {};

    if (Array.isArray(rawBody)) {
      isJsonPatch = true;
      const patchOps = rawBody as Operation[];
      // Validate ops to mimic fast-json-patch error behavior on invalid ops
      const validOps = new Set(['add', 'remove', 'replace', 'move', 'copy', 'test']);
      for (const op of patchOps) {
        if (!validOps.has(op.op as string)) {
          throw new Error('invalid op');
        }
      }
      // Fetch minimal board state (need column ids in order)
      const boardState = await prisma.board.findUnique({
        where: { id: boardId },
        include: { columns: { orderBy: { order: 'asc' } } },
      });
      if (!boardState) {
        throw new Error('Board state not found during patch application');
      }
      // Derive DB actions from ops
      for (const op of patchOps) {
        if (op.op === 'replace' && op.path === '/title') {
          jsonPatchBoardData.title = op.value as string;
        }
        if (op.op === 'remove' && op.path.startsWith('/columns/')) {
          const indexStr = op.path.split('/')[2];
          const index = Number(indexStr);
          if (!Number.isNaN(index) && index >= 0 && index < boardState.columns.length) {
            const col = boardState.columns[index];
            jsonPatchColumnsToDelete.push(col.id);
          }
        }
      }
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      // JSON Merge Patch object
      mergeObj = rawBody;
      // Build direct board update payload from raw body for predictable tx arguments
      const rb = rawBody as Record<string, unknown>;
      if (typeof rb.title === 'string') mergeBoardUpdateData.title = rb.title as string;
      if (rb.theme === 'light' || rb.theme === 'dark') mergeBoardUpdateData.theme = rb.theme as 'light' | 'dark';
    } else {
      // Should be caught earlier, but handle defensively
      return NextResponse.json({ error: 'Invalid patch format' }, { status: 400 });
    }

    // Validate the resulting object (from merge or patch application)
    const patch = isJsonPatch ? BoardPatchSchema.parse({}) : BoardPatchSchema.parse(mergeObj);

    // --- Start Transaction --- 
    await prisma.$transaction(async (tx) => {
      // Board fields
      const boardData: Record<string, unknown> = isJsonPatch ? jsonPatchBoardData : mergeBoardUpdateData;
      if (Object.keys(boardData).length) {
        await tx.board.update({ where: { id: boardId }, data: boardData });
      }
      // Columns
      if (!isJsonPatch && patch.columns) {
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
      } else if (isJsonPatch) {
        if (jsonPatchColumnsToDelete.length > 0) {
          for (const colId of jsonPatchColumnsToDelete) {
            await tx.column.delete({ where: { id: colId } });
          }
        }
      }
      // Cards
      if (!isJsonPatch && patch.cards) {
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
      if (!isJsonPatch && patch.labels) {
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
              create: { id: label.id, name: label.name ?? '', color: label.color ?? '', boardId: boardId }
            });
          }
        }
      }
      // Comments
      if (!isJsonPatch && patch.comments) {
        for (const cm of patch.comments) {
          if (cm._delete) {
            await tx.comment.delete({ where: { id: cm.id } });
          } else if (cm.content !== undefined) {
            await tx.comment.update({ where: { id: cm.id }, data: { content: cm.content } });
          }
        }
      }
      // Attachments
      if (!isJsonPatch && patch.attachments) {
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
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error(`[API PATCH /api/boards/${boardId}] Patch error:`, e);
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Patch validation failed', issues: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}