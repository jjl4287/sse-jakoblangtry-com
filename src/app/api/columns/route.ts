import { NextResponse } from 'next/server';
import { columnService } from '~/lib/services/column-service';
import { jsonError } from '~/lib/api/response';
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
    const column = await columnService.createColumn({ title, width, boardId });
    return NextResponse.json(column);
  } catch (error: unknown) {
    return jsonError(error);
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
    const updatedColumns = await columnService.reorderColumns(boardId, columnOrders);
    return NextResponse.json({ message: 'Columns reordered successfully', columns: updatedColumns });
  } catch (error: unknown) {
    return jsonError(error);
  }
} 