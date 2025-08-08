import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import fs from 'fs/promises';
import path from 'path';
import { stat, mkdir, writeFile } from 'fs/promises'; // For checking/creating directory and writing file
import { getErrorMessage, hasErrorCode } from '~/lib/errors/utils';

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
    
    const attachment = await prisma.attachment.create({
      data: attachmentData,
    });
    
    await prisma.activityLog.create({
        data: {
            actionType: attachmentData.type === 'link' ? "ADD_LINK_ATTACHMENT_TO_CARD" : "ADD_FILE_ATTACHMENT_TO_CARD",
            cardId,
            userId,
            details: {
                attachmentId: attachment.id,
                attachmentName: attachment.name,
                attachmentUrl: attachment.url,
                attachmentType: attachment.type,
            },
        },
    });

    return NextResponse.json(attachment, { status: 201 });

  } catch (error: unknown) {
    console.error(`[API POST /api/cards/${cardId}/attachments] Error:`, error);
    // It's good to distinguish between file system errors and other errors
    if (
      error instanceof Error &&
      (error.message.includes('upload directory') || hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'EACCES'))
    ) {
      return NextResponse.json({ error: 'File system error during upload.' }, { status: 500 });
    }
    const message = getErrorMessage(error) || 'Failed to upload attachment';
    return NextResponse.json({ error: message }, { status: 500 });
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

    // Fetch attachments for the card
    const attachments = await prisma.attachment.findMany({
      where: { cardId },
      orderBy: { createdAt: 'asc' }, // Optional: order by creation time
    });

    return NextResponse.json(attachments);

  } catch (error: unknown) {
    console.error(`[API GET /api/cards/${cardId}/attachments] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch attachments';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 