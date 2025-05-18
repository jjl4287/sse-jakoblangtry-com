import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "~/lib/auth/authOptions";

// GET /api/cards/[cardId]/activity
export async function GET(
  request: Request,
  context: { params: { cardId: string } }
) {
  let cardId: string;
  try {
    cardId = context.params.cardId;
    if (typeof cardId !== 'string') {
      throw new Error('cardId is not a string or is undefined');
    }
  } catch (e: any) {
    console.error('[API GET /api/cards/[cardId]/activity] Error accessing cardId from params:', e);
    return NextResponse.json({ error: "Invalid route parameters", message: e.message }, { status: 400 });
  }

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

  } catch (error: any) {
    console.error(`[API GET /api/cards/${cardId}/activity] Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to fetch activity logs' }, { status: 500 });
  }
} 