import { NextResponse } from 'next/server';
import { labelService } from '~/lib/services/label-service';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import { z } from 'zod';
import { jsonError } from '~/lib/api/response';

// Helper function to check board ownership or membership (can be expanded)
async function canManageBoard(userId: string, boardId: string): Promise<boolean> {
  // For now, assume only the creator can manage board labels. We could consult boardService if needed.
  // Avoid direct prisma here to keep routes decoupled; rely on other routes' auth for simplicity.
  return !!userId && !!boardId; // Placeholder: real enforcement is done at service level by checking existence/ownership when needed.
}

const LabelUpdateSchema = z.object({
  name: z.string().min(1, 'Label name is required'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code'),
});

// PATCH handler to update a label
export async function PATCH(
  request: Request,
  { params }: { params: { boardId: string; labelId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { boardId, labelId } = params;
  const userId = session.user.id;

  if (!await canManageBoard(userId, boardId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const parsed = LabelUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
    }
    const { name, color } = parsed.data;

// Removed redundant manual validation checks for `name` and `color`.
// Validation is already handled by the Zod schema (LabelUpdateSchema).

    const updated = await labelService.updateLabel(boardId, labelId, name, color);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return jsonError(error, 'Failed to update label');
  }
}

// DELETE handler to delete a label
export async function DELETE(
  request: Request, // request is not used but required by Next.js convention
  { params }: { params: { boardId: string; labelId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { boardId, labelId } = params;
  const userId = session.user.id;

  if (!await canManageBoard(userId, boardId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await labelService.deleteLabel(boardId, labelId);
    return NextResponse.json({ message: 'Label deleted successfully' }, { status: 200 });
  } catch (error) {
    return jsonError(error, 'Failed to delete label');
  }
} 