export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';

/**
 * POST /api/boards/[id]/invite
 * Generates a shareable invite URL for the board
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: boardId } = await params;
  // Construct invite link using request URL origin
  const origin = new URL(request.url).origin;
  const inviteUrl = `${origin}/?boardId=${boardId}`;
  return NextResponse.json({ inviteUrl });
} 