import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { z } from 'zod';
import { type Card, type Prisma } from '@prisma/client'; // Use type-only import for Card
import { getServerSession } from "next-auth/next"; // Added for session
import { authOptions } from "~/lib/auth/authOptions"; // Added for session
import { formatCardForAPI } from '~/lib/utils/cardFormatting';

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
    const card = await prisma.card.findUnique({
      where: { id: cardId },
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

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Map to the expected Card format using shared utility
    const formattedCard = formatCardForAPI(card);

    return NextResponse.json(formattedCard);
  } catch (_error: unknown) {
    console.error('[API GET /api/cards/[cardId]] Error:', _error);
    const message = _error instanceof Error ? _error.message : 'Failed to fetch card';
    return NextResponse.json({ error: message }, { status: 500 });
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

    // Fetch the card before updates to compare values for logging
    const cardBeforeUpdate = await prisma.card.findUnique({
      where: { id: cardId },
      select: {
        title: true,
        description: true,
        priority: true,
        dueDate: true,
        weight: true,
        labels: true,
        assignees: true,
        columnId: true,
        boardId: true,
        order: true,
      }
    });

    if (!cardBeforeUpdate) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const {
      labelIdsToAdd,
      labelIdsToRemove,
      assigneeIdsToAdd,
      assigneeIdsToRemove,
      dueDate,
      ...otherUpdates
    } = validatedUpdates;

    const dataForUpdate: CardUpdateData = { ...otherUpdates };

    if (dueDate) {
      dataForUpdate.dueDate = new Date(dueDate);
    }

    if (labelIdsToAdd && labelIdsToAdd.length > 0) {
      dataForUpdate.labels = {
        ...(dataForUpdate.labels ?? {}),
        connect: labelIdsToAdd.map((labelId: string) => ({ id: labelId })),
      };
    }
    if (labelIdsToRemove && labelIdsToRemove.length > 0) {
      dataForUpdate.labels = {
        ...(dataForUpdate.labels ?? {}),
        disconnect: labelIdsToRemove.map((labelId: string) => ({ id: labelId })),
      };
    }

    if (assigneeIdsToAdd && assigneeIdsToAdd.length > 0) {
      dataForUpdate.assignees = {
        ...(dataForUpdate.assignees ?? {}),
        connect: assigneeIdsToAdd.map((userId: string) => ({ id: userId })),
      };
    }
    if (assigneeIdsToRemove && assigneeIdsToRemove.length > 0) {
      dataForUpdate.assignees = {
        ...(dataForUpdate.assignees ?? {}),
        disconnect: assigneeIdsToRemove.map((userId: string) => ({ id: userId })),
      };
    }

    const updatedCard: Card = await prisma.card.update({
      where: { id: cardId },
      data: dataForUpdate as Prisma.CardUpdateInput,
      include: {
        labels: true,
        assignees: true,
      }
    });

    // Activity Logging
    const activityLogs: Prisma.ActivityLogCreateManyInput[] = [];

    if (validatedUpdates.title && validatedUpdates.title !== cardBeforeUpdate.title) {
      activityLogs.push({
        actionType: "UPDATE_CARD_TITLE",
        cardId,
        userId,
        details: { old: cardBeforeUpdate.title, new: validatedUpdates.title },
      });
    }
    if (validatedUpdates.description && validatedUpdates.description !== cardBeforeUpdate.description) {
      activityLogs.push({
        actionType: "UPDATE_CARD_DESCRIPTION",
        cardId,
        userId,
        details: { old: cardBeforeUpdate.description, new: validatedUpdates.description },
      });
    }
    if (validatedUpdates.priority && validatedUpdates.priority !== cardBeforeUpdate.priority) {
      activityLogs.push({
        actionType: "UPDATE_CARD_PRIORITY",
        cardId,
        userId,
        details: { old: cardBeforeUpdate.priority, new: validatedUpdates.priority },
      });
    }
    if (validatedUpdates.dueDate) {
      const newDueDate = new Date(validatedUpdates.dueDate).toISOString();
      const oldDueDate = cardBeforeUpdate.dueDate ? new Date(cardBeforeUpdate.dueDate).toISOString() : null;
      if (newDueDate !== oldDueDate) {
        activityLogs.push({
          actionType: "UPDATE_CARD_DUEDATE",
          cardId,
          userId,
          details: { old: oldDueDate, new: newDueDate },
        });
      }
    }

    if (validatedUpdates.weight !== undefined && validatedUpdates.weight !== cardBeforeUpdate.weight) {
      activityLogs.push({
        actionType: "UPDATE_CARD_WEIGHT",
        cardId,
        userId,
        details: { old: cardBeforeUpdate.weight, new: validatedUpdates.weight },
      });
    }

    if (validatedUpdates.labelIdsToAdd) {
      for (const labelId of validatedUpdates.labelIdsToAdd) {
        const label = await prisma.label.findUnique({ where: { id: labelId }, select: { name: true }});
        activityLogs.push({
          actionType: "ADD_LABEL_TO_CARD",
          cardId,
          userId,
          details: { labelId, labelName: label?.name ?? 'Unknown Label' },
        });
      }
    }
    if (validatedUpdates.labelIdsToRemove) {
      for (const labelId of validatedUpdates.labelIdsToRemove) {
        const label = cardBeforeUpdate.labels.find(l => l.id === labelId);
        activityLogs.push({
          actionType: "REMOVE_LABEL_FROM_CARD",
          cardId,
          userId,
          details: { labelId, labelName: label?.name ?? 'Unknown Label' },
        });
      }
    }

    if (validatedUpdates.assigneeIdsToAdd) {
      for (const assigneeId of validatedUpdates.assigneeIdsToAdd) {
        const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true, email: true }});
        activityLogs.push({
          actionType: "ADD_ASSIGNEE_TO_CARD",
          cardId,
          userId,
          details: { assigneeId, assigneeName: assignee?.name ?? assignee?.email ?? 'Unknown User' },
        });
      }
    }
    if (validatedUpdates.assigneeIdsToRemove) {
      for (const assigneeId of validatedUpdates.assigneeIdsToRemove) {
        const assignee = cardBeforeUpdate.assignees.find(a => a.id === assigneeId);
        activityLogs.push({
          actionType: "REMOVE_ASSIGNEE_FROM_CARD",
          cardId,
          userId,
          details: { assigneeId, assigneeName: assignee?.name ?? assignee?.email ?? 'Unknown User' },
        });
      }
    }
    
    // Add other logs like order changes if necessary

    if (activityLogs.length > 0) {
      await prisma.activityLog.createMany({ data: activityLogs });
    }

    return NextResponse.json(updatedCard);
  } catch (error) {
    // Log with updated parameter name
    console.error(`[API PATCH /api/cards/${cardId}] Error:`, error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
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
    // Fetch card details for logging before deleting
    const cardToDelete = await prisma.card.findUnique({
      where: { id: cardId },
      select: { 
        title: true,
        labels: true,
        assignees: true,
      }
    });

    if (!cardToDelete) {
      // Card already deleted or never existed, still return success or a 404
      return NextResponse.json({ success: true, message: "Card not found or already deleted." });
    }

    // Log the deletion activity BEFORE deleting the card (since ActivityLog has foreign key to Card)
    await prisma.activityLog.create({
      data: {
        actionType: "DELETE_CARD",
        cardId,
        userId,
        details: {
          title: cardToDelete.title ?? 'Untitled Card',
          labelCount: cardToDelete.labels.length,
          assigneeCount: cardToDelete.assignees.length,
        }
      }
    });

    // Start a transaction to ensure all deletes happen atomically
    await prisma.$transaction(async (tx) => {
      // 1. Disconnect all many-to-many relationships
      await tx.card.update({
        where: { id: cardId },
        data: {
          labels: {
            disconnect: cardToDelete.labels.map(label => ({ id: label.id }))
          },
          assignees: {
            disconnect: cardToDelete.assignees.map(assignee => ({ id: assignee.id }))
          }
        }
      });

      // 2. Delete attachments (no cascading delete in schema)
      await tx.attachment.deleteMany({
        where: { cardId }
      });

      // 3. Comments and ActivityLogs will be automatically deleted due to onDelete: Cascade
      
      // 4. Finally delete the card
      await tx.card.delete({ where: { id: cardId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Log with updated parameter name
    console.error(`[API DELETE /api/cards/${cardId}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 