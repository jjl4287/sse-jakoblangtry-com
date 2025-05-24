import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import { formatCardForAPI } from '~/lib/utils/cardFormatting';

// GET /api/cards?columnId=...
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const columnId = url.searchParams.get('columnId');

    if (!columnId) {
      return NextResponse.json({ error: 'Column ID is required' }, { status: 400 });
    }

    // Fetch cards for the specified column
    const cards = await prisma.card.findMany({
      where: { columnId },
      orderBy: { order: 'asc' },
      include: {
        labels: true,
        assignees: true,
        attachments: true,
        comments: {
          include: {
            user: true
          }
        }
      }
    });

    // Map to the expected Card format using shared utility
    const formattedCards = cards.map(formatCardForAPI);

    return NextResponse.json(formattedCards);
  } catch (_error: unknown) {
    console.error('[API GET /api/cards] Error:', _error);
    const message = _error instanceof Error ? _error.message : 'Failed to fetch cards';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/cards
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const body = (await request.json()) as {
      columnId: string;
      title: string;
      description?: string;
      dueDate?: string;
      priority?: 'low' | 'medium' | 'high';
      weight?: number;
      labelIds?: string[];
      assigneeIds?: string[];
    };

    const { 
        columnId, 
        title, 
        description = '', 
        dueDate, 
        priority = 'medium',
        weight,
        labelIds = [], 
        assigneeIds = [] 
    } = body;

    if (!columnId || !title) {
        return NextResponse.json({ error: 'Column ID and Title are required' }, { status: 400 });
    }

    // Fetch the column to get the boardId
    const column = await prisma.column.findUnique({
        where: { id: columnId },
        select: { boardId: true } // boardId in Column is the boardId for the Card
    });

    if (!column?.boardId) {
        return NextResponse.json({ error: 'Column not found or does not belong to a board' }, { status: 404 });
    }
    const boardId = column.boardId;

    // Determine next order index
    const maxOrderCard = await prisma.card.findFirst({
      where: { columnId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const order = maxOrderCard ? maxOrderCard.order + 1 : 0;
    
    // Create the card
    const newCard = await prisma.card.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: priority ?? 'medium',
        order,
        weight,
        column: { connect: { id: columnId } },
        board: { connect: { id: boardId } }, // Connect to the board
        // user field is not directly on card for creator, this is handled by board or activity log
        labels: labelIds.length > 0 ? {
          connect: labelIds.map(id => ({ id })),
        } : undefined,
        assignees: assigneeIds.length > 0 ? {
          connect: assigneeIds.map(id => ({ id })),
        } : undefined,
      },
      include: {
        labels: true,
        assignees: true,
        attachments: true,
        comments: true,
        // activityLogs: true, // Optionally include activity logs if needed in response
      }
    });

    // Create an activity log for card creation
    await prisma.activityLog.create({
      data: {
        actionType: "CREATE_CARD",
        card: { connect: { id: newCard.id } },
        user: { connect: { id: session.user.id } }, // The user who performed the action
        details: {
          title: newCard.title,
          columnId: columnId,
          // boardId: boardId, // already in card relation
        }
      }
    });

    return NextResponse.json(newCard);
  } catch (_error: unknown) {
    console.error('[API POST /api/cards] Error:', _error);
    const message = _error instanceof Error ? _error.message : 'Failed to create card';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 