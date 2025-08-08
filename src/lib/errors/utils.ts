export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return typeof error === 'string' ? error : JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

type MaybeWithCode = { code?: string } | { code?: unknown } | Record<string, unknown>;

export function hasErrorCode(error: unknown, code: string): boolean {
  if (error && typeof error === 'object' && 'code' in (error as MaybeWithCode)) {
    const val = (error as MaybeWithCode).code;
    return typeof val === 'string' && val === code;
  }
  return false;
}

export function getErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in (error as MaybeWithCode)) {
    const val = (error as MaybeWithCode).code;
    return typeof val === 'string' ? val : null;
  }
  return null;
}

