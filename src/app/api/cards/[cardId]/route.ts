import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { cardService } from '~/lib/services/card-service';
import { jsonError } from '~/lib/api/response';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { getServerSession } from "next-auth/next"; // Added for session
import { authOptions } from "~/lib/auth/authOptions"; // Added for session
// import { formatCardForAPI } from '~/lib/utils/cardFormatting';

// GET /api/cards/[cardId]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const card = await cardService.getCardById(cardId);
    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    return NextResponse.json(card);
  } catch (error: unknown) {
    return jsonError(error, 'Failed to fetch card');
  }
}

// Schema for validating incoming card update data
const CardUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime({ offset: true }).optional().or(z.string().optional()), // Allow date string or full ISO string
  priority: z.enum(['low', 'medium', 'high']).optional(),
  order: z.number().optional(),
  weight: z.number().optional(),
  labelIdsToAdd: z.array(z.string()).optional(),
  labelIdsToRemove: z.array(z.string()).optional(),
  assigneeIdsToAdd: z.array(z.string()).optional(),
  assigneeIdsToRemove: z.array(z.string()).optional(),
});

// Define a type for the data object passed to prisma.card.update
// This helps avoid using `any` and provides better type checking.
type CardUpdateData = Omit<Prisma.CardUpdateInput, 'labels' | 'assignees'> & {
  dueDate?: Date;
  labels?: Prisma.LabelUpdateManyWithoutCardsNestedInput;
  assignees?: Prisma.UserUpdateManyWithoutAssignedCardsNestedInput;
};

// PATCH /api/cards/[cardId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  
  // Check if this is a temporary ID (optimistic update)
  if (cardId.startsWith('temp_') || cardId.startsWith('temp_card_')) {
    // For temporary IDs, just return success without doing anything
    // The optimistic update system will replace this with the real ID once the card is created
    return NextResponse.json({ 
      id: cardId, 
      message: 'Temporary card update ignored - will be processed when card is persisted' 
    });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const rawUpdates: unknown = await request.json();
    const validatedUpdates = CardUpdateSchema.parse(rawUpdates);

    const { labelIdsToAdd = [], labelIdsToRemove = [], assigneeIdsToAdd = [], assigneeIdsToRemove = [], dueDate, ...otherUpdates } = validatedUpdates;

    // Prefer specialized mutations when only labels/assignees change; otherwise do generic update
    if (
      Object.keys(otherUpdates).length === 0 && dueDate === undefined &&
      (labelIdsToAdd.length || labelIdsToRemove.length)
    ) {
      const card = await cardService.updateCardLabels(cardId, labelIdsToAdd, labelIdsToRemove, userId);
      return NextResponse.json(card);
    }

    if (
      Object.keys(otherUpdates).length === 0 && dueDate === undefined &&
      (assigneeIdsToAdd.length || assigneeIdsToRemove.length)
    ) {
      const card = await cardService.updateCardAssignees(cardId, assigneeIdsToAdd, assigneeIdsToRemove, userId);
      return NextResponse.json(card);
    }

    const card = await cardService.updateCard(
      cardId,
      {
        ...otherUpdates,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      },
      userId
    );
    return NextResponse.json(card);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', issues: error.errors }, { status: 400 });
    }
    return jsonError(error);
  }
}

// DELETE /api/cards/[cardId]
export async function DELETE(
  request: Request, // request is not used, but required for Next.js route handlers
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;
  
  // Check if this is a temporary ID (optimistic update)
  if (cardId.startsWith('temp_') || cardId.startsWith('temp_card_')) {
    // For temporary IDs, just return success without doing anything
    // The optimistic update system will handle the local removal
    return NextResponse.json({ 
      success: true,
      message: 'Temporary card delete ignored - handled by optimistic updates' 
    });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    await cardService.deleteCard(cardId, userId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return jsonError(error);
  }
} 