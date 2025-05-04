export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '~/lib/prisma';

/**
 * POST /api/groups/[id]/members
 * Adds a user to a group by userId
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const groupId = params.id;
  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  try {
    await prisma.groupMember.create({ data: { groupId, userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API POST /api/groups/${groupId}/members]`, error);
    return NextResponse.json({ error: 'Failed to add user to group' }, { status: 500 });
  }
} 