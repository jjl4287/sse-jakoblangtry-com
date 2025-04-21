import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';

// PATCH /api/columns/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
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
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    await prisma.column.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[API DELETE /api/columns/${id}] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 