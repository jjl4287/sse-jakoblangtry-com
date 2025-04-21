import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';

// PATCH /api/cards/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const updates = await request.json();
    // Convert ISO date strings back to Date where needed
    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate as string);
    }
    const card = await prisma.card.update({
      where: { id },
      data: updates as any,
    });
    return NextResponse.json(card);
  } catch (error: any) {
    console.error(`[API PATCH /api/cards/${params.id}] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/cards/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.card.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[API DELETE /api/cards/${params.id}] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 