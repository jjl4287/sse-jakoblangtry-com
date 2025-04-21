import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import type { NextRequest } from 'next/server';

// POST /api/columns
export async function POST(request: NextRequest) {
  try {
    const { title, width } = await request.json() as { title: string; width: number };
    // Ensure default project
    let project = await prisma.project.findFirst();
    if (!project) {
      project = await prisma.project.create({ data: { title: 'Default Project', theme: 'dark' } });
    }
    // Determine order by counting existing columns
    const count = await prisma.column.count({ where: { projectId: project.id } });
    // Create column
    const column = await prisma.column.create({
      data: { title, width, order: count, projectId: project.id }
    });
    return NextResponse.json(column);
  } catch (error: any) {
    console.error('[API POST /api/columns] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 