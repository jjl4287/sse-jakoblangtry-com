import { NextRequest, NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { z } from 'zod';

const ColumnInputSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
  width: z.number().optional().default(280), // Default width if not provided
});

// POST /api/columns
export async function POST(request: NextRequest) {
  // Use req.nextUrl.searchParams
  const projectId = request.nextUrl.searchParams.get('projectId'); 

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  let data;
  try {
    data = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validation = ColumnInputSchema.safeParse(data);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: validation.error.issues },
      { status: 400 }
    );
  }

  try {
    // Find the current maximum order for the project
    const maxOrderColumn = await prisma.column.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = (maxOrderColumn?.order ?? 0) + 1;

    // Create the new column
    const newColumn = await prisma.column.create({
      data: {
        ...validation.data,
        projectId,
        order: nextOrder,
      },
    });
    return NextResponse.json(newColumn, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API POST /api/columns] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create column', details: message },
      { status: 500 }
    );
  }
} 