import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';

// POST /api/cards/[id]/move
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Parse request body once
    const { targetColumnId, order: newOrder } = await request.json() as {
      targetColumnId: string;
      order: number;
    };

    // Retry on transaction conflicts
    const MAX_RETRIES = 5;
    let attempt = 0;
    while (true) {
      try {
        await prisma.$transaction(
          async (tx) => {
            // Fetch original card and its column
            const original = await tx.card.findUnique({ where: { id } });
            if (!original) {
              throw new Error('Card not found');
            }
            const oldColumnId = original.columnId;
            // Same-column reorder
            if (oldColumnId === targetColumnId) {
              const cards = await tx.card.findMany({
                where: { columnId: oldColumnId },
                orderBy: { order: 'asc' }
              });
              const ids = cards.map(c => c.id);
              const fromIdx = ids.indexOf(id);
              ids.splice(fromIdx, 1);
              ids.splice(newOrder, 0, id);
              // Batch-persist new orders
              const ops = ids.map((cardId, idx) =>
                tx.card.update({ where: { id: cardId }, data: { order: idx } })
              );
              await Promise.all(ops);
            } else {
              // Cross-column move: fetch both lists
              const srcCards = await tx.card.findMany({
                where: { columnId: oldColumnId },
                orderBy: { order: 'asc' }
              });
              const destCards = await tx.card.findMany({
                where: { columnId: targetColumnId },
                orderBy: { order: 'asc' }
              });
              const srcIds = srcCards.map(c => c.id).filter(cardId => cardId !== id);
              const destIds = destCards.map(c => c.id);
              destIds.splice(newOrder, 0, id);
              // Move the card
              await tx.card.update({
                where: { id },
                data: { column: { connect: { id: targetColumnId } }, order: newOrder }
              });
              // Batch-persist destination and source orders
              const destOps = destIds.map((cardId, idx) =>
                tx.card.update({ where: { id: cardId }, data: { order: idx } })
              );
              const srcOps = srcIds.map((cardId, idx) =>
                tx.card.update({ where: { id: cardId }, data: { order: idx } })
              );
              await Promise.all([...destOps, ...srcOps]);
            }
          },
          { timeout: 60000, maxWait: 5000 }
        );
        // If we get here, transaction succeeded
        break;
      } catch (txError: any) {
        // Retry on write conflicts
        if (txError?.code === 'P2034' && attempt < MAX_RETRIES - 1) {
          // Exponential backoff before retrying
          const backoffMs = 200 * (2 ** attempt);
          await new Promise((res) => setTimeout(res, backoffMs));
          attempt++;
          continue;
        }
        throw txError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[API POST /api/cards/${id}/move] Error:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 