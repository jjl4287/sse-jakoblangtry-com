import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma';
import { z } from 'zod';

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

    const updatedBoard = await prisma.board.updateMany({
      where: {
        id: boardId,
        creatorId: session.user.id,
      },
      data: {
        title: title.trim(),
      },
    });

    if (updatedBoard.count === 0) {
      // This means either the board doesn't exist or the user doesn't own it.
      // For security, don't reveal which one.
      return NextResponse.json(
        { error: 'Board not found or user not authorized to update this board' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Board title updated successfully' });
  } catch (error) {
    console.error(`[API PATCH /api/boards/${boardId}] Error:`, error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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
    // Delete the board and all related data
    const deletedBoard = await prisma.board.deleteMany({
      where: {
        id: boardId,
        creatorId: session.user.id,
      },
    });

    if (deletedBoard.count === 0) {
      // This means either the board doesn't exist or the user doesn't own it.
      // For security, don't reveal which one.
      return NextResponse.json(
        { error: 'Board not found or user not authorized to delete this board' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error(`[API DELETE /api/boards/${boardId}] Error:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 