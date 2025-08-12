import { NextResponse } from 'next/server';
import { attachmentService } from '~/lib/services/attachment-service';
import { accessService } from '~/lib/services/access-service';
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
    // Authorization: check card access
    const canAccess = await accessService.canAccessCard(userId, cardId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
    }

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
    
    // 3. Delete the attachment via service (it logs activity)
    await attachmentService.deleteAttachment(attachmentId, userId);

    return NextResponse.json({ success: true, message: 'Attachment deleted' });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete attachment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 