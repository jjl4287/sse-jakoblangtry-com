import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE(
  request: Request, // Not used, but part of the signature
  { params: paramsPromise }: { params: Promise<{ cardId: string, attachmentId: string }> }
) {
  const { cardId, attachmentId } = await paramsPromise;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // 1. Authorization: Check if user can modify the card
    const card = await prisma.card.findUnique({
      where: { id: cardId },
      select: { board: { select: { creatorId: true, members: { select: { userId: true } } } } },
    });

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const isOwner = card.board.creatorId === userId;
    const isMember = card.board.members.some(member => member.userId === userId);

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Find the attachment to get its details (like URL for file deletion)
    const attachmentToDelete = await prisma.attachment.findUnique({
      where: { id: attachmentId, cardId: cardId }, // Ensure it belongs to the correct card
    });

    if (!attachmentToDelete) {
      return NextResponse.json({ error: 'Attachment not found on this card' }, { status: 404 });
    }

    // 3. Delete the attachment record from DB
    await prisma.attachment.delete({
      where: { id: attachmentId },
    });

    // 4. Delete the actual file from the filesystem
    //    The URL stored is like `/uploads/cards/[cardId]/[filename]`
    //    We need to convert this to a full server path.
    const filePathOnServer = path.join(process.cwd(), 'public', attachmentToDelete.url);
    try {
      await fs.unlink(filePathOnServer);
    } catch (fileError: unknown) {
      // Log if file deletion fails, but don't necessarily fail the whole request,
      // as the DB record is more critical. Or, decide to make it an atomic failure.
      console.error(`Failed to delete file ${filePathOnServer}:`, fileError);
      // Optionally, re-create the attachment record if file deletion is critical and fails.
      // For now, we'll proceed assuming DB deletion is the primary goal.
    }
    
    // 5. Log activity
    await prisma.activityLog.create({
        data: {
            actionType: "DELETE_ATTACHMENT_FROM_CARD",
            cardId,
            userId,
            details: {
                attachmentId: attachmentToDelete.id,
                attachmentName: attachmentToDelete.name,
                attachmentUrl: attachmentToDelete.url, // Log the URL of the deleted file
            },
        },
    });

    return NextResponse.json({ success: true, message: 'Attachment deleted' });

  } catch (error: unknown) {
    console.error(`[API DELETE /api/cards/${cardId}/attachments/${attachmentId}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to delete attachment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 