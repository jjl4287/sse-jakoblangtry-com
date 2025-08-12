import { NextResponse } from 'next/server';
import { commentService } from '~/lib/services/comment-service';
import { accessService } from '~/lib/services/access-service';
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

    // Access check: card visibility
    const canAccess = await accessService.canAccessCard(userId, cardId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
    }

    // Update using service (enforces author-only edit)
    const updatedComment = await commentService.updateComment(commentId, content, userId);
    return NextResponse.json(updatedComment);
  } catch (error: unknown) {
    console.error(`[API PATCH /api/cards/${cardId}/comments/${commentId}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to update comment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 