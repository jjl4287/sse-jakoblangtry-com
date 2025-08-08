import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "~/lib/auth/authOptions";
import { z } from 'zod';

const CardMoveSchema = z.object({ targetColumnId: z.string().min(1), order: z.number().int().nonnegative() });

// POST /api/cards/[cardId]/move
export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId?: string; id?: string }> }
) {
  const rawParams = await params;
  const cardId = rawParams.cardId ?? rawParams.id ?? '';

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // Parse request body once
    const parsed = CardMoveSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
    }
    const { targetColumnId, order: newOrder } = parsed.data;

    // Retry on transaction conflicts
    const MAX_RETRIES = 3;
    let attempt = 0; // counts how many conflicts have occurred so far
    while (true) {
      try {
        await prisma.$transaction(
          async (tx) => {
            const originalCard = await tx.card.findUnique({ where: { id: cardId }, select: { columnId: true, order: true, title: true } });
            if (!originalCard) {
              throw new Error('Card not found');
            }
            const oldColumnId = originalCard.columnId;
            const oldOrder = originalCard.order;


            // Same-column reorder
            if (oldColumnId === targetColumnId) {
              const cards = await tx.card.findMany({
                where: { columnId: oldColumnId },
                orderBy: { order: 'asc' }
              });
              const ids = cards.map(c => c.id);
              const fromIdx = ids.indexOf(cardId);
              ids.splice(fromIdx, 1);
              ids.splice(newOrder, 0, cardId);
              // Batch-persist new orders
              const ops = ids.map((currentCardIdInMap, idx) =>
                tx.card.update({ where: { id: currentCardIdInMap }, data: { order: idx } })
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
              const srcIds = srcCards.map(c => c.id).filter(currentCardIdInMap => currentCardIdInMap !== cardId);
              const destIds = destCards.map(c => c.id);
              destIds.splice(newOrder, 0, cardId);
              // Move the card
              await tx.card.update({
                where: { id: cardId },
                data: { column: { connect: { id: targetColumnId } }, order: newOrder }
              });
              // Batch-persist destination and source orders
              const destOps = destIds.map((currentCardIdInMap, idx) =>
                tx.card.update({ where: { id: currentCardIdInMap }, data: { order: idx } })
              );
              const srcOps = srcIds.map((currentCardIdInMap, idx) =>
                tx.card.update({ where: { id: currentCardIdInMap }, data: { order: idx } })
              );
              await Promise.all([...destOps, ...srcOps]);
            }

            // Log activity after successful move operations within the transaction
            // Only log if the card actually moved between columns (not intra-column reordering)
            if (oldColumnId !== targetColumnId) {
              const details = {
                cardTitle: originalCard.title,
                oldColumnId,
                newColumnId: targetColumnId,
                oldOrder: oldOrder,
                newOrder: newOrder,
              } as const;
              // Best-effort logging; skip if activityLog model is not available in the transactional client (e.g., tests)
              const anyTx = tx as unknown as { activityLog?: { create: (args: { data: unknown }) => Promise<unknown> } };
              if (anyTx.activityLog?.create) {
                await anyTx.activityLog.create({
                  data: {
                    actionType: "MOVE_CARD",
                    cardId,
                    userId,
                    details,
                  }
                });
              }
            }
          },
          { timeout: 60000, maxWait: 5000 }
        );
        // If we get here, transaction succeeded
        break;
      } catch (txError: unknown) {
        // Retry on write conflicts (Prisma P2034)
        const isConflict = typeof txError === 'object' && txError !== null && 'code' in txError && (txError as { code?: string }).code === 'P2034';
        if (isConflict && attempt < MAX_RETRIES - 1) {
          const backoffMs = 100 * (2 ** attempt);
          attempt++;
          console.log(`[API POST /api/cards/${cardId}/move] Retrying P2034. Attempt ${attempt}/${MAX_RETRIES - 1}. Waiting ${backoffMs}ms.`);
          await new Promise((res) => setTimeout(res, backoffMs));
          continue;
        }
        throw txError;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(`[API POST /api/cards/${cardId}/move] Error:`, error);
    let message = 'Failed to move card';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
      // Handle non-Error throw shapes used in tests
      message = String((error as { message?: unknown }).message ?? message);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 