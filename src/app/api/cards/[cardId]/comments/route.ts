import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import type { NextRequest } from 'next/server';

// GET /api/cards/[cardId]/comments
export async function GET(
  request: NextRequest, // request is not used yet, but good for consistency
  { params }: { params: { cardId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { cardId } = params;

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
  } catch (error: any) {
    console.error(`[API GET /api/cards/${cardId}/comments] Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/cards/[cardId]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: { cardId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { cardId } = params;
  const userId = session.user.id;

  try {
    const body = await request.json();
    const { content } = body as { content: string };

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

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
  } catch (error: any) {
    console.error(`[API POST /api/cards/${cardId}/comments] Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to create comment' }, { status: 500 });
  }
} 