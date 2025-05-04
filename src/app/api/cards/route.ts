import { NextRequest, NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { z } from 'zod';

// Zod schema for card creation input validation
const CardInputSchema = z.object({
  columnId: z.string(),
  title: z.string().min(1, "Title cannot be empty"),
  description: z.string().optional(),
  dueDate: z.string().datetime({ offset: true }).optional(), // Expect ISO 8601 format
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

// POST /api/cards
export async function POST(request: NextRequest) {
  let data;
  try {
    data = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = CardInputSchema.safeParse(data);

  if (!validation.success) {
    // Return validation errors
    return NextResponse.json(
      { error: 'Validation failed', issues: validation.error.issues },
      { status: 400 }
    );
  }

  try {
    const { columnId, title, description, dueDate, priority } = validation.data;

    // Find the current maximum order for the column
    const maxOrderCard = await prisma.card.findFirst({
      where: { columnId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxOrderCard?.order ?? 0) + 1;

    // Create the card
    const card = await prisma.card.create({
      data: {
        column: { connect: { id: columnId } },
        title,
        description: description ?? '',
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority,
        order: nextOrder, // Use calculated order
      },
      // Include relations if needed in the response
      include: {
        labels: true,
        assignees: { select: { id: true, name: true, image: true } }, // Select specific user fields
      }
    });
    // Return 201 Created on success
    return NextResponse.json(card, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API POST /api/cards] Error:', error);
    // Return 500 Internal Server Error for database/other errors
    return NextResponse.json(
      { error: 'Failed to create card', details: message },
      { status: 500 }
    );
  }
} 