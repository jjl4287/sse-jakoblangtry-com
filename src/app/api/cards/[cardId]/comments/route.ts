import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// GET /api/cards/[cardId]/comments
export async function GET(
  request: NextRequest,
  { params }: { params: { cardId: string } }
) {
  const { cardId } = params;

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // First, check if the card exists and if the user has access to the board it belongs to.
    // This is a simplified check; a more robust check would verify board membership or ownership.
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        column: {
          select: {
            board: {
              select: { creatorId: true, members: { select: { userId: true } } } // For checking ownership or membership
            }
          }
        }
      }
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const boardOwnerId = card.column.board.creatorId;
    const isMember = card.column.board.members.some(member => member.userId === session.user.id);

    if (boardOwnerId !== session.user.id && !isMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const comments = await prisma.comment.findMany({
      where: { cardId },
      orderBy: { createdAt: 'asc' }, // Get comments in chronological order
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true }, // Select user fields for display
        },
      },
    });
    return NextResponse.json(comments);
  } catch (error: unknown) {
    console.error(`[API GET /api/cards/${cardId}/comments] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch comments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const CommentCreateSchema = z.object({ content: z.string().min(1, 'Comment content is required') });

// POST /api/cards/[cardId]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: { cardId: string } }
) {
  const { cardId } = params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const parsed = CommentCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
    }
    const { content } = parsed.data;

    // Similar access check as in GET before creating comment
    const cardCheck = await prisma.card.findUnique({
        where: { id: cardId },
        select: { column: { select: { board: { select: { creatorId: true, members: { select: { userId: true } } } } } } }
    });
    if (!cardCheck) {
        return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    const boardOwnerId = cardCheck.column.board.creatorId;
    const isMember = cardCheck.column.board.members.some(member => member.userId === userId);
    if (boardOwnerId !== userId && !isMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const newComment = await prisma.comment.create({
      data: {
        content: content.trim(),
        card: { connect: { id: cardId } },
        user: { connect: { id: userId } }, // Link to the authenticated user
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(newComment, { status: 201 }); // 201 Created
  } catch (error: unknown) {
    console.error(`[API POST /api/cards/${cardId}/comments] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to create comment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 