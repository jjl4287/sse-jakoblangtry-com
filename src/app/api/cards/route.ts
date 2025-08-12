import { NextResponse } from 'next/server';
import { cardService } from '~/lib/services/card-service';
import { jsonError } from '~/lib/api/response';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
// import { formatCardForAPI } from '~/lib/utils/cardFormatting';

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

    const cards = await cardService.getCardsByColumnId(columnId);
    return NextResponse.json(cards);
  } catch (error: unknown) {
    return jsonError(error);
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

    const { columnId, title, description, dueDate, priority, weight, labelIds, assigneeIds } = body;
    if (!columnId || !title) {
      return NextResponse.json({ error: 'Column ID and Title are required' }, { status: 400 });
    }

    const newCard = await cardService.createCard(
      {
        title,
        description,
        columnId,
        boardId: '', // boardId is inferred in repository/service via column lookup if needed
        priority,
        weight,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        labelIds,
        assigneeIds,
      },
      session.user.id
    );

    return NextResponse.json(newCard);
  } catch (error: unknown) {
    return jsonError(error);
  }
} 