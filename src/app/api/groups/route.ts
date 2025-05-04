export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '~/lib/prisma';

/**
 * GET /api/groups
 * Lists all groups the current user is a member of
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  try {
    const groups = await prisma.group.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(groups);
  } catch (error) {
    console.error('[API GET /api/groups]', error);
    return NextResponse.json({ error: 'Failed to list groups' }, { status: 500 });
  }
}

/**
 * POST /api/groups
 * Creates a new group
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { name } = await request.json();
  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  try {
    const group = await prisma.group.create({ data: { name } });
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error('[API POST /api/groups]', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
} 