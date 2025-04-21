import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';

// POST /api/cards/[id]/move
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const { targetColumnId, order: newOrder } = (await request.json()) as {
      targetColumnId: string;
      order: number;
    };

    await prisma.$transaction(async (tx) => {
      const card = await tx.card.findUnique({ where: { id } });
      if (!card) throw new Error('Card not found');
      const oldColumnId = card.columnId;
      const oldOrder = card.order;

      if (oldColumnId === targetColumnId) {
        if (newOrder !== oldOrder) {
          if (newOrder < oldOrder) {
            // Shift cards down between newOrder and oldOrder - 1
            await tx.card.updateMany({
              where: { columnId: oldColumnId, order: { gte: newOrder, lt: oldOrder } },
              data: { order: { increment: 1 } },
            });
          } else {
            // Shift cards up between oldOrder + 1 and newOrder
            await tx.card.updateMany({
              where: { columnId: oldColumnId, order: { gt: oldOrder, lte: newOrder } },
              data: { order: { decrement: 1 } },
            });
          }
        }
      } else {
        // Remove gap in old column
        await tx.card.updateMany({
          where: { columnId: oldColumnId, order: { gt: oldOrder } },
          data: { order: { decrement: 1 } },
        });
        // Make space in new column
        await tx.card.updateMany({
          where: { columnId: targetColumnId, order: { gte: newOrder } },
          data: { order: { increment: 1 } },
        });
      }

      // Update the card's column and order
      await tx.card.update({
        where: { id },
        data: { column: { connect: { id: targetColumnId } }, order: newOrder },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[API POST /api/cards/${params.id}/move] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 