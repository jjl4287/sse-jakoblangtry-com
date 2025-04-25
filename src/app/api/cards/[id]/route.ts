import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { z } from 'zod';

// Schema for validating incoming card update data
const CardUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  order: z.number().optional(),
  labels: z.array(z.object({ id: z.string(), name: z.string(), color: z.string() })).optional(),
  assignees: z.array(z.string()).optional(),
});

// PATCH /api/cards/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rawUpdates = await request.json();
    const updates = CardUpdateSchema.parse(rawUpdates);
    // Convert ISO date strings back to Date where needed
    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate);
    }
    const card = await prisma.card.update({
      where: { id },
      data: updates,
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