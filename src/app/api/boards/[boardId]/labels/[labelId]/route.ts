import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import { z } from 'zod';

// Helper function to check board ownership or membership (can be expanded)
async function canManageBoard(userId: string, boardId: string): Promise<boolean> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { creatorId: true }, // Check if owner (creatorId matches session user)
  });
  return board?.creatorId === userId;
}

const LabelUpdateSchema = z.object({
  name: z.string().min(1, 'Label name is required'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code'),
});

// PATCH handler to update a label
export async function PATCH(
  request: Request,
  { params }: { params: { boardId: string; labelId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { boardId, labelId } = params;
  const userId = session.user.id;

  if (!await canManageBoard(userId, boardId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const parsed = LabelUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
    }
    const { name, color } = parsed.data;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Label name is required' }, { status: 400 });
    }
    if (!color || typeof color !== 'string' || !/^#[0-9A-F]{6}$/i.test(color)) {
      return NextResponse.json({ error: 'Valid hex color code is required' }, { status: 400 });
    }

    const updatedLabel = await prisma.label.updateMany({ // updateMany to ensure it's for the correct board
      where: {
        id: labelId,
        boardId: boardId, 
        // Optional: Add board: { userId: userId } here if only owner can edit their board labels directly
        // For now, canManageBoard handles the top-level auth.
      },
      data: {
        name: name.trim(),
        color: color,
      },
    });

    if (updatedLabel.count === 0) {
      return NextResponse.json({ error: 'Label not found or not part of this board' }, { status: 404 });
    }
    
    // Fetch the updated label to return it
    const labelToReturn = await prisma.label.findUnique({
        where: {id: labelId}
    })

    return NextResponse.json(labelToReturn, { status: 200 });
  } catch (error) {
    console.error('Error updating label:', error);
    return NextResponse.json({ error: 'Failed to update label' }, { status: 500 });
  }
}

// DELETE handler to delete a label
export async function DELETE(
  request: Request, // request is not used but required by Next.js convention
  { params }: { params: { boardId: string; labelId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { boardId, labelId } = params;
  const userId = session.user.id;

  if (!await canManageBoard(userId, boardId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // First, dissociate the label from all cards
    // This is important to avoid foreign key constraint issues if cards have this label
    await prisma.card.updateMany({
      where: {
        labels: {
          some: { id: labelId },
        },
        column: {
          boardId: boardId, // ensure we only update cards on this board
        }
      },
      data: {
        labels: {
          disconnect: [{ id: labelId }],
        },
      },
    });
    
    // Then, delete the label itself
    const deletedLabel = await prisma.label.deleteMany({ // deleteMany to ensure it's for the correct board
      where: {
        id: labelId,
        boardId: boardId,
        // Optional: board: { userId: userId } constraint if needed
      },
    });

    if (deletedLabel.count === 0) {
      return NextResponse.json({ error: 'Label not found or not part of this board' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Label deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting label:', error);
    // Check for specific Prisma errors if needed, e.g., P2025 (Record to delete does not exist)
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
} 