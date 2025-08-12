import { NextResponse } from 'next/server';
import { authService } from '~/lib/services/auth-service';
import { z } from 'zod';
import { jsonError } from '~/lib/api/response';

const RegisterSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * POST /api/auth/register
 * Creates a new user if the username is not already taken.
 */
export async function POST(request: Request) {
  try {
    const parsed = RegisterSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.errors }, { status: 400 });
    }
    const { username, email, password } = parsed.data;
    try {
      const user = await authService.register(username, email, password);
      return NextResponse.json(user, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      const status = msg.includes('already in use') ? 409 : 500;
      return NextResponse.json({ error: msg }, { status });
    }
  } catch (err: unknown) {
    return jsonError(err);
  }
} 