import { NextResponse } from 'next/server';
import prisma from '~/lib/prisma';
import bcrypt from 'bcrypt';

/**
 * POST /api/auth/register
 * Creates a new user if the username is not already taken.
 */
export async function POST(request: Request) {
  try {
    const { username, email, password } = await request.json();
    if (!username?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'Username, email, and password are required' }, { status: 400 });
    }
    // Prevent duplicate username or email
    const existing = await prisma.user.findFirst({
      where: { OR: [{ name: username }, { email }] }
    });
    if (existing) {
      return NextResponse.json({ error: 'Username or email already in use' }, { status: 409 });
    }
    // Hash the password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10');
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // Create new user
    const user = await prisma.user.create({
      data: {
        name: username,
        email,
        hashedPassword
      }
    });
    return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
  } catch (err: any) {
    console.error('[API POST /api/auth/register] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 