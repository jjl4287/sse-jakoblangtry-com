import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

const ColumnCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  width: z.number().min(1, 'Width must be a positive number'),
  boardId: z.string().min(1, 'Board ID is required'),
});

const ColumnReorderSchema = z.object({
  boardId: z.string().min(1, 'Board ID is required'),
  columnOrders: z.array(z.object({
    id: z.string().min(1, 'Column ID is required'),
    order: z.number().min(0, 'Order must be non-negative'),
  })).min(1, 'At least one column order must be provided'),
});

// POST /api/columns
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const parsed = ColumnCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
    }
    const { title, width, boardId } = parsed.data;
    
    // Validate that the board exists
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }
    // Determine order by counting existing columns
    const count = await prisma.column.count({ where: { boardId: board.id } });
    // Create column
    const column = await prisma.column.create({ data: { title, width, order: count, boardId: board.id } });
    return NextResponse.json(column);
  } catch (error: unknown) {
    console.error('[API POST /api/columns] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PATCH /api/columns - Reorder columns
export async function PATCH(request: NextRequest) {
  try {
    // Validate request body
    const parsed = ColumnReorderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
    }
    const { boardId, columnOrders } = parsed.data;
    
    // Validate that the board exists
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    // Validate that all columns belong to the board
    const columnIds = columnOrders.map(co => co.id);
    const existingColumns = await prisma.column.findMany({
      where: { id: { in: columnIds }, boardId },
    });

    if (existingColumns.length !== columnIds.length) {
      return NextResponse.json({ error: 'Some columns not found or do not belong to this board' }, { status: 400 });
    }

    // Update column orders in a transaction
    const updatePromises = columnOrders.map(({ id, order }) =>
      prisma.column.update({
        where: { id },
        data: { order },
        include: {
          cards: {
            include: {
              labels: true,
              assignees: {
                select: { id: true, name: true, email: true, image: true }
              },
              attachments: true,
            },
            orderBy: { order: 'asc' }
          }
        }
      })
    );

    const updatedColumns = await prisma.$transaction(updatePromises);

    return NextResponse.json({ 
      message: 'Columns reordered successfully',
      columns: updatedColumns 
    });
  } catch (error: unknown) {
    console.error('[API PATCH /api/columns] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 