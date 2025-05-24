import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "~/lib/auth/authOptions";

// GET /api/cards/[cardId]/activity
export async function GET(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await paramsPromise;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // First, verify if the user has access to the board this card belongs to
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        boardId: true,
        board: {
          select: {
            creatorId: true,
            members: {
              where: { userId },
              select: { userId: true }
            }
          }
        }
      }
    });

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const board = card.board;
    const isOwner = board.creatorId === userId;
    const isMember = board.members.some(member => member.userId === userId);

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: "Forbidden: You do not have access to this board's activities" }, { status: 403 });
    }

    // Fetch activity logs
    const activityLogs = await prisma.activityLog.findMany({
      where: { cardId },
      orderBy: { createdAt: 'desc' }, // Newest first
      include: {
        user: { // Include user details for the activity
          select: {
            id: true,
            name: true,
            image: true,
            email: true // Email as fallback if name is not set
          }
        }
      }
    });

    return NextResponse.json(activityLogs);

  } catch (error: unknown) {
    console.error(`[API GET /api/cards/${cardId}/activity] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch activity logs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 