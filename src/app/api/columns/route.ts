import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import type { NextRequest } from 'next/server';

// POST /api/columns
export async function POST(request: NextRequest) {
  try {
    // Read title and width
    const { title, width } = (await request.json()) as { title: string; width: number };
    // Determine board from query param or fallback
    const boardId = request.nextUrl.searchParams.get('boardId');
    let board = boardId
      ? await prisma.board.findUnique({ where: { id: boardId } })
      : await prisma.board.findFirst();
    if (!board) {
      // Fallback: create default board
      board = await prisma.board.create({ data: { title: 'Default Board', theme: 'dark', userId: 'admin' } });
    }
    // Determine order by counting existing columns
    const count = await prisma.column.count({ where: { projectId: board.id } });
    // Create column
    const column = await prisma.column.create({ data: { title, width, order: count, projectId: board.id } });
    return NextResponse.json(column);
  } catch (error: any) {
    console.error('[API POST /api/columns] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 