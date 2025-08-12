import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import fs from 'fs/promises';
import path from 'path';
import { stat, mkdir, writeFile } from 'fs/promises'; // For checking/creating directory and writing file
import { getErrorMessage, hasErrorCode } from '~/lib/errors/utils';
import { jsonError } from '~/lib/api/response';
import { attachmentService } from '~/lib/services/attachment-service';
import { accessService } from '~/lib/services/access-service';

// Ensure the upload directory exists
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'cards');

async function ensureUploadDirExists() {
  try {
    await stat(UPLOAD_DIR);
  } catch (e: unknown) {
    if (hasErrorCode(e, 'ENOENT')) {
      try {
        await mkdir(UPLOAD_DIR, { recursive: true });
      } catch (mkdirError: unknown) {
        console.error('Failed to create upload directory:', mkdirError);
        throw new Error('Failed to create upload directory.');
      }
    } else {
      console.error('Failed to check upload directory:', e);
      throw new Error('Failed to check upload directory.');
    }
  }
}


export async function POST(
  request: Request,
  { params: paramsPromise }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await paramsPromise;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const canAccess = await accessService.canAccessCard(userId, cardId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') || '';
    let attachmentData;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      await ensureUploadDirExists();
      const cardUploadDir = path.join(UPLOAD_DIR, cardId);
      try {
        await stat(cardUploadDir);
      } catch (e: unknown) {
        if (hasErrorCode(e, 'ENOENT')) {
          await mkdir(cardUploadDir, { recursive: true });
        } else {
          throw e;
        }
      }
      
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const originalFilename = file.name;
      const safeFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}_${safeFilename}`;
      const filePath = path.join(cardUploadDir, uniqueFilename);
      
      await writeFile(filePath, fileBuffer);

      const fileUrl = `/uploads/cards/${cardId}/${uniqueFilename}`;

      attachmentData = {
        name: originalFilename,
        url: fileUrl,
        type: file.type || 'file', // Use file.type or default to 'file'
        card: { connect: { id: cardId } },
      };
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      const { url, name } = body;

      if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
      }
      // Basic URL validation (can be enhanced)
      try {
        new URL(url);
      } catch (_) {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
      }

      attachmentData = {
        name: name || url, // Use provided name or the URL itself as name
        url: url,
        type: 'link',
        card: { connect: { id: cardId } },
      };
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 415 });
    }
    
    const attachment = await attachmentService.createAttachment(cardId, {
      name: attachmentData.name,
      url: attachmentData.url,
      type: attachmentData.type,
    }, userId);

    return NextResponse.json(attachment, { status: 201 });

  } catch (error: unknown) {
    // Distinguish file system errors explicitly
    if (
      error instanceof Error &&
      (error.message.includes('upload directory') || hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'EACCES'))
    ) {
      return NextResponse.json({ error: 'File system error during upload.' }, { status: 500 });
    }
    return jsonError(error, 'Failed to upload attachment');
  }
}

// We can add GET handler here later to list attachments for a card.
export async function GET(
  request: Request, // request is not used, but helpful for consistency
  { params: paramsPromise }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await paramsPromise;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id; // For authorization checks

  try {
    // Authorization: Check if user can access the card (and thus its attachments)
    const canAccess = await accessService.canAccessCard(userId, cardId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Card not found or access denied' }, { status: 404 });
    }

    // Fetch attachments for the card
    const attachments = await attachmentService.getAttachmentsByCardId(cardId);
    return NextResponse.json(attachments);

  } catch (error: unknown) {
    return jsonError(error, 'Failed to fetch attachments');
  }
} 