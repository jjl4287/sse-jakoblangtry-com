export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '~/lib/prisma';

/**
 * POST /api/boards/[id]/join
 * Current authenticated user joins the board
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const boardId = params.id;
  const userId = session.user.id;
  try {
    await prisma.boardMember.create({
      data: { boardId, userId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API POST /api/boards/${boardId}/join]`, error);
    return NextResponse.json({ error: 'Failed to join board' }, { status: 500 });
  }
} 