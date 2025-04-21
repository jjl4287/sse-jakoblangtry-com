import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import type { NextRequest } from 'next/server';

// POST /api/cards
export async function POST(request: NextRequest) {
  try {
    const { columnId, title, description = '', dueDate, priority } = (await request.json()) as {
      columnId: string;
      title: string;
      description?: string;
      dueDate?: string;
      priority: 'low' | 'medium' | 'high';
    };
    // Determine next order index
    const order = await prisma.card.count({ where: { columnId } });
    // Create the card
    const card = await prisma.card.create({
      data: {
        column: { connect: { id: columnId } },
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority,
        order,
      },
    });
    return NextResponse.json(card);
  } catch (error: any) {
    console.error('[API POST /api/cards] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 