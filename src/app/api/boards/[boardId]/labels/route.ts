import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from '~/lib/auth/authOptions';
import { labelService } from '~/lib/services/label-service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { jsonError } from '~/lib/api/response';
import { z } from 'zod';

const LabelCreateSchema = z.object({
  name: z.string().min(1, 'Label name is required'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex code'),
});

// GET /api/boards/[boardId]/labels - List labels for a board
export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;

    if (!boardId) {
      return NextResponse.json(
        { error: 'Board ID is required' },
        { status: 400 }
      );
    }

    const labels = await labelService.getBoardLabels(boardId);
    return NextResponse.json(labels);
  } catch (_error: unknown) {
    return jsonError(_error);
  }
}

// POST /api/boards/[boardId]/labels - Create a new label for a board
export async function POST(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { boardId } = await params;
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

    const newLabel = await labelService.createLabel(boardId, name, color);
    return NextResponse.json(newLabel, { status: 201 });
  } catch (_error: unknown) {
    if (_error instanceof PrismaClientKnownRequestError && _error.code === 'P2002') {
      return NextResponse.json({ error: 'A label with this name already exists on this board.' }, { status: 409 });
    }
    return jsonError(_error);
  }
} 