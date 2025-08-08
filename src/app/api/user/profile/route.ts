import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma';
import { writeFile, mkdir, stat } from 'fs/promises';
import path from 'path';
import { getErrorMessage, hasErrorCode } from '~/lib/errors/utils';

const AVATAR_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

async function ensureAvatarDirExists() {
  try {
    await stat(AVATAR_UPLOAD_DIR);
  } catch (e: unknown) {
    if (hasErrorCode(e, 'ENOENT')) {
      try {
        await mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
      } catch (mkdirError: unknown) {
        console.error('Failed to create avatar upload directory:', mkdirError);
        throw new Error('Failed to create avatar upload directory.');
      }
    } else {
      console.error('Failed to check avatar upload directory:', e);
      throw new Error('Failed to check avatar upload directory.');
    }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: unknown) {
    console.error('[API GET /api/user/profile] Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    let updateData: { name?: string; image?: string } = {};

    if (contentType.includes('multipart/form-data')) {
      // Handle avatar upload
      const formData = await request.formData();
      const file = formData.get('avatar') as File | null;
      const name = formData.get('name') as string | null;

      if (name) {
        updateData.name = name.trim();
      }

      if (file) {
        await ensureAvatarDirExists();
        
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const originalFilename = file.name;
        const fileExtension = path.extname(originalFilename);
        const safeFilename = `${session.user.id}_${Date.now()}${fileExtension}`;
        const filePath = path.join(AVATAR_UPLOAD_DIR, safeFilename);
        
        await writeFile(filePath, fileBuffer);
        
        const avatarUrl = `/uploads/avatars/${safeFilename}`;
        updateData.image = avatarUrl;
      }
    } else {
      // Handle JSON data
      const body = await request.json();
      if (body.name !== undefined) {
        updateData.name = body.name?.trim() || null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: unknown) {
    console.error('[API PATCH /api/user/profile] Error:', error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
} 