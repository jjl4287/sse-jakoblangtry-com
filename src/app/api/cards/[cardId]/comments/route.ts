import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonError } from '~/lib/api/response';
import { commentService } from '~/lib/services/comment-service';
import { accessService } from '~/lib/services/access-service';

// GET /api/cards/[cardId]/comments
export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await paramsPromise;

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const canAccess = await accessService.canAccessCard(session.user.id, cardId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
    }
    const comments = await commentService.getCommentsByCardId(cardId);
    return NextResponse.json(comments);
  } catch (error: unknown) {
    return jsonError(error, 'Failed to fetch comments');
  }
}

const CommentCreateSchema = z.object({ content: z.string().min(1, 'Comment content is required') });

// POST /api/cards/[cardId]/comments
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await paramsPromise;

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

    const canAccess = await accessService.canAccessCard(userId, cardId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
    }
    const newComment = await commentService.createComment(cardId, userId, content);
    return NextResponse.json(newComment, { status: 201 });
  } catch (error: unknown) {
    return jsonError(error, 'Failed to create comment');
  }
} 