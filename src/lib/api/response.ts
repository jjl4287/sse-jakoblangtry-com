import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DomainError } from '~/lib/errors/domain-errors';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

export function jsonOk(data: JsonValue, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as unknown as Record<string, unknown>, init);
}

export function jsonError(error: unknown, fallbackMessage = 'Internal server error'): NextResponse {
  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Validation failed', issues: error.errors }, { status: 400 });
  }

  // Domain errors with status and code
  if (error instanceof DomainError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Generic errors
  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function handleRoute<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return jsonOk(data as unknown as JsonValue);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[API Error]', err);
    return jsonError(err);
  }
}


