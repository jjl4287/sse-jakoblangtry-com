import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { boardId } = await params;
  if (!boardId) {
    return new NextResponse('Board ID is required', { status: 400 });
  }

  try {
    // First check if user has access to this board (is a member or creator)
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { creatorId: session.user.id },
          { members: { some: { userId: session.user.id } } },
          { isPublic: true }
        ]
      }
    });

    if (!board) {
      return new NextResponse('Board not found or access denied', { status: 404 });
    }

    // Fetch all board members including the creator
    const members = await prisma.boardMembership.findMany({
      where: { boardId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      }
    });

    // Transform to match BoardMembership type
    const formattedMembers = members.map(member => ({
      id: member.id,
      role: member.role,
      userId: member.userId,
      boardId: member.boardId,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        image: member.user.image,
      }
    }));

    return NextResponse.json(formattedMembers);
  } catch (error) {
    console.error(`[API GET /api/boards/${boardId}/members] Error:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 