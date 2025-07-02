import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const CommentUpdateSchema = z.object({ 
  content: z.string().min(1, 'Comment content is required') 
});

// PATCH /api/cards/[cardId]/comments/[commentId]
export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ cardId: string; commentId: string }> }
) {
  const { cardId, commentId } = await paramsPromise;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const parsed = CommentUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
    }
    const { content } = parsed.data;

    // Find the comment and verify access
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        card: {
          select: {
            id: true,
            column: {
              select: {
                board: {
                  select: { 
                    creatorId: true, 
                    members: { select: { userId: true } } 
                  }
                }
              }
            }
          }
        },
        user: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    });

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Verify the comment belongs to the specified card
    if (comment.card.id !== cardId) {
      return NextResponse.json({ error: 'Comment does not belong to this card' }, { status: 400 });
    }

    // Check if user has access to the board (owner, member, or comment author)
    const boardOwnerId = comment.card.column.board.creatorId;
    const isMember = comment.card.column.board.members.some(member => member.userId === userId);
    const isCommentAuthor = comment.userId === userId;

    if (boardOwnerId !== userId && !isMember && !isCommentAuthor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the comment
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content: content.trim() },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    });

    return NextResponse.json(updatedComment);
  } catch (error: unknown) {
    console.error(`[API PATCH /api/cards/${cardId}/comments/${commentId}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to update comment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 