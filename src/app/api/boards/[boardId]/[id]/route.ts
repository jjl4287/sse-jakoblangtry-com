import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError } from '~/lib/api/response';
import { boardService } from '~/lib/services/board-service';

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
    // Delegate to service (authorization/business rules reside there)
    await boardService.deleteBoard(id, 'system');
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return jsonError(error);
  }
}

// PATCH /api/boards/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id: boardId } = params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body: Expected JSON' }, { status: 400 });
  }

  try {
    // Only accept title/theme updates through this route now
    const rb = rawBody as Record<string, unknown>;
    const updates: Partial<{ title: string; theme: 'light' | 'dark' }> = {};
    if (typeof rb.title === 'string') updates.title = rb.title;
    if (rb.theme === 'light' || rb.theme === 'dark') updates.theme = rb.theme;

    if (!updates.title && !updates.theme) {
      return NextResponse.json({ success: true });
    }

    await boardService.updateBoard(boardId, updates);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Patch validation failed', issues: e.errors }, { status: 400 });
    }
    if (e instanceof Error && e.message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return jsonError(e);
  }
}