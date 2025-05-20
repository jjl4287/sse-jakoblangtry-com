import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from '~/lib/auth/authOptions';
import prisma from '~/lib/prisma';
import type { Label } from '~prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

interface LabelPostBody {
  name: string;
  color: string;
}

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
  } catch (error) {
    console.error('[GET /api/boards/[boardId]/labels] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
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
    const body = (await request.json()) as LabelPostBody;

    if (!boardId) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    if (!body.name || !body.color) {
      return NextResponse.json(
        { error: 'Label name and color are required' },
        { status: 400 }
      );
    }

    const newLabel = await prisma.label.create({
      data: {
        name: body.name,
        color: body.color,
        boardId: boardId,
      },
    });

    return NextResponse.json(newLabel, { status: 201 });
  } catch (error) {
    console.error('[POST /api/boards/[boardId]/labels] Error:', error);
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'A label with this name already exists on this board.' }, { status: 409 });
      }
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 