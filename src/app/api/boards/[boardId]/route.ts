import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { boardId: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { boardId } = params;
  if (!boardId) {
    return new NextResponse('Board ID is required', { status: 400 });
  }

  try {
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return new NextResponse('Title is required and must be a non-empty string', {
        status: 400,
      });
    }

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
      return new NextResponse(
        'Board not found or user not authorized to update this board',
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Board title updated successfully' });
  } catch (error) {
    console.error(`[API PATCH /api/boards/${boardId}] Error:`, error);
    if (error instanceof SyntaxError) {
      return new NextResponse('Invalid JSON in request body', { status: 400 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 