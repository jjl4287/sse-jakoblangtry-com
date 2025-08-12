import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import { boardService } from '~/lib/services/board-service';
import { z } from 'zod';
import { jsonError } from '~/lib/api/response';

const BoardPatchSchema = z.object({ title: z.string().min(1, 'Title is required') });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { boardId } = await params;
  if (!boardId) {
    return NextResponse.json({ error: 'Board ID is required' }, { status: 400 });
  }

  try {
    const parsed = BoardPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 });
    }
    const { title } = parsed.data;

    try {
      await boardService.updateBoard(boardId, { title: title.trim() });
      return NextResponse.json({ message: 'Board title updated successfully' });
    } catch (e: unknown) {
      return NextResponse.json({ error: 'Board not found or user not authorized to update this board' }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { boardId } = await params;
  if (!boardId) {
    return NextResponse.json({ error: 'Board ID is required' }, { status: 400 });
  }

  try {
    try {
      await boardService.deleteBoard(boardId, session.user.id);
      return NextResponse.json({ message: 'Board deleted successfully' });
    } catch (e: unknown) {
      return NextResponse.json({ error: 'Board not found or user not authorized to delete this board' }, { status: 404 });
    }
  } catch (error) {
    return jsonError(error);
  }
} 