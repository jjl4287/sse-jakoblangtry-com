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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body: Expected JSON' }, { status: 400 });
  }

  try {
    let mergeObj: unknown;

    // Handle JSON Patch application inside the main try block
    if (Array.isArray(rawBody)) {
      const patchOps = rawBody as Operation[];
      // Fetch board state - Reduced depth for efficiency
      const boardState = await prisma.board.findUnique({
        where: { id: boardId },
        include: {
          // Only include columns and basic card info initially
          // If a patch targets deeper nested card fields, it might fail
          // or require adjustments later.
          columns: {
            include: {
              // Fetch cards, but not their nested relations (labels, comments etc.)
              cards: true 
            }
          }
          // Intentionally omitting includes for labels, comments, attachments at board level for pre-fetch
        },
      });
      if (!boardState) {
        throw new Error('Board state not found during patch application');
      }
      // Convert Prisma Decimal to number for JSON compatibility if needed, and apply patch
      // Note: JSON.stringify/parse is a common way but might have type fidelity issues (e.g., Date -> string)
      // Consider a more robust deep cloning/conversion method if necessary.
      const plainDoc = JSON.parse(JSON.stringify(boardState)) as unknown;
      const patchResult = applyPatch<unknown>(plainDoc, patchOps);

      mergeObj = patchResult.newDocument;
    } else if (typeof rawBody === 'object' && rawBody !== null) {
      // JSON Merge Patch object
      mergeObj = rawBody;
    } else {
      // Should be caught earlier, but handle defensively
      return NextResponse.json({ error: 'Invalid patch format' }, { status: 400 });
    }

    // Validate the resulting object (from merge or patch application)
    const patch = BoardPatchSchema.parse(mergeObj);

    // --- Start Transaction --- 
    await prisma.$transaction(async (tx) => {
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
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error(`[API PATCH /api/boards/${boardId}] Patch error:`, e);
    const msg = e instanceof Error ? e.message : String(e);
    // Distinguish between Zod validation errors and other errors if needed
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Patch validation failed', issues: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Extend the payload to include board metadata and relations
type ProjectWithRelations = Prisma.BoardGetPayload<{
  include: {
    user: true;
    boardMembers: { include: { user: true } };
    boardGroups: { include: { group: true } };
    pinned: true;
    isPublic: true;
    columns: {
      orderBy: { order: 'asc' };
      include: {
        cards: {
          orderBy: { order: 'asc' };
          include: { labels: true; attachments: true; comments: true; assignees: true }
        }
      }
    }
  }
}>;

const mapToBoard = (project: ProjectWithRelations): Board => ({
  id: project.id,
  title: project.title,
  theme: project.theme === 'light' ? 'light' : 'dark',
  userId: project.userId,
  user: { id: project.user.id, name: project.user.name, email: project.user.email, image: project.user.image },
  boardMembers: project.boardMembers.map(bm => ({ id: bm.id, userId: bm.userId, boardId: bm.boardId })),
  boardGroups: project.boardGroups.map(bg => ({ id: bg.id, boardId: bg.boardId, groupId: bg.groupId })),
  pinned: project.pinned,
  isPublic: project.isPublic,
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
      assignees: card.assignees.map(u => ({ id: u.id, name: u.name, email: u.email, image: u.image })),
      priority: card.priority,
      attachments: card.attachments.map(a => ({ id: a.id, name: a.name, url: a.url, type: a.type, createdAt: a.createdAt })),
      comments: card.comments.map(c => ({ id: c.id, author: c.author, content: c.content, createdAt: c.createdAt })),
      dueDate: card.dueDate ?? undefined,
    })),
  })),
});

// GET /api/boards/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await dynamic params per Next.js spec
  const { id: boardId } = await params;
  try {
    // Only fetch if public, owner, or member
    // @ts-expect-error TS type doesn't include OR in findFirst filters
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { isPublic: true },
          { userId },
          { boardMembers: { some: { userId } } }
        ]
      },
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
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Convert to frontend Board type
    const out = mapToBoard(board);
    return NextResponse.json(out);
  } catch (error: unknown) {
    console.error(`[API GET /api/boards/${boardId}] Error:`, error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}