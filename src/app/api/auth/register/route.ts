import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';

/**
 * POST /api/auth/register
 * Creates a new user if the username is not already taken.
 */
export async function POST(request: Request) {
  try {
    const { username } = await request.json();
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    // Check if user already exists
    const existing = await prisma.user.findFirst({ where: { name: username } });
    if (existing) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }
    // Create new user
    const user = await prisma.user.create({ data: { name: username } });
    return NextResponse.json({ id: user.id, name: user.name }, { status: 201 });
  } catch (err: any) {
    console.error('[API POST /api/auth/register] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 