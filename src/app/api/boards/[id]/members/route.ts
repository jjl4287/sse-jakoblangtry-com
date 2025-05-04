export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '~/lib/prisma';
import { z } from 'zod';

// Schema for invite payload
const InviteMemberSchema = z.object({ email: z.string().email() });
export { InviteMemberSchema };

/**
 * GET /api/boards/[id]/members
 * Lists all members of a board
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: boardId } = await params;
  try {
    const members = await prisma.boardMember.findMany({
      where: { boardId },
      include: { user: true },
    });
    const result = members.map(m => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      joinedAt: m.createdAt,
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[API GET /api/boards/${boardId}/members]`, error);
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}

/**
 * POST /api/boards/[id]/members
 * Invites a user to the board by email
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
  let email: string;
  try {
    ({ email } = InviteMemberSchema.parse(await request.json()));
  } catch (err) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }
  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: email.split('@')[0] },
      update: {},
    });
    await prisma.boardMember.create({
      data: { boardId, userId: user.id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API POST /api/boards/${boardId}/members]`, error);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
} 