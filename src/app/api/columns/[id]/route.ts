import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';

// PATCH /api/columns/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Check if this is a temporary ID (optimistic update)
  if (id.startsWith('temp_col_') || id.startsWith('temp_')) {
    // For temporary IDs, just return success without doing anything
    // The optimistic update system will replace this with the real ID once the column is created
    return NextResponse.json({ 
      id, 
      message: 'Temporary column update ignored - will be processed when column is persisted' 
    });
  }
  
  try {
    const updates = await request.json();
    const column = await prisma.column.update({
      where: { id },
      data: updates,
    });
    return NextResponse.json(column);
  } catch (error: any) {
    console.error(`[API PATCH /api/columns/${id}] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/columns/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Check if this is a temporary ID (optimistic update)
  if (id.startsWith('temp_col_') || id.startsWith('temp_')) {
    // For temporary IDs, just return success without doing anything
    // The optimistic update system will handle the local removal
    return NextResponse.json({ 
      success: true,
      message: 'Temporary column delete ignored - handled by optimistic updates' 
    });
  }
  
  try {
    await prisma.column.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[API DELETE /api/columns/${id}] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 