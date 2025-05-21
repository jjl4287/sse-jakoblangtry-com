import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { z } from 'zod';

const LabelCreateSchema = z.object({
  name: z.string().min(1, 'Label name is required'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code'),
});

// GET /api/boards/[boardId]/labels - List labels for a board
export async function GET(
  request: Request,
  { params }: { params: { boardId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = params;

    if (!boardId) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    const labels = await prisma.label.findMany({
      where: {
        boardId: boardId,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(labels);
  } catch (_error: unknown) {
    console.error('[GET /api/boards/[boardId]/labels] Error:', _error);
    const message = _error instanceof Error ? _error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/boards/[boardId]/labels - Create a new label for a board
export async function POST(
  request: Request,
  { params }: { params: { boardId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = params;
    const parsed = LabelCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
    }
    const { name, color } = parsed.data;

    if (!boardId) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    const newLabel = await prisma.label.create({
      data: {
        name: name,
        color: color,
        boardId: boardId,
      },
    });

    return NextResponse.json(newLabel, { status: 201 });
  } catch (_error: unknown) {
    console.error('[POST /api/boards/[boardId]/labels] Error:', _error);
    if (_error instanceof PrismaClientKnownRequestError) {
      if (_error.code === 'P2002') {
        return NextResponse.json({ error: 'A label with this name already exists on this board.' }, { status: 409 });
      }
    }
    const message = _error instanceof Error ? _error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 