export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '~/lib/prisma';
import { z } from 'zod';

// Schema for share board with group payload
const ShareGroupSchema = z.object({ groupId: z.string() });
export { ShareGroupSchema };

/**
 * GET /api/boards/[id]/groups
 * Lists all groups shared with a board
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
    const boardGroups = await prisma.boardGroup.findMany({
      where: { boardId },
      include: { group: true },
    });
    const result = boardGroups.map(bg => ({
      id: bg.group.id,
      name: bg.group.name,
      createdAt: bg.createdAt,
      updatedAt: bg.group.updatedAt,
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[API GET /api/boards/${boardId}/groups]`, error);
    return NextResponse.json({ error: 'Failed to list groups' }, { status: 500 });
  }
}

/**
 * POST /api/boards/[id]/groups
 * Shares a board with a group
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
  let groupId: string;
  try {
    ({ groupId } = ShareGroupSchema.parse(await request.json()));
  } catch {
    return NextResponse.json({ error: 'Invalid groupId' }, { status: 400 });
  }
  try {
    await prisma.boardGroup.create({
      data: { boardId, groupId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[API POST /api/boards/${boardId}/groups]`, error);
    return NextResponse.json({ error: 'Failed to share board' }, { status: 500 });
  }
} 