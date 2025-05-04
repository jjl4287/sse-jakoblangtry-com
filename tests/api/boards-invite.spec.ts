// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getServerSession before importing route
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
import { getServerSession } from 'next-auth/next';
import { POST } from '~/app/api/boards/[id]/invite/route';

describe('POST /api/boards/[id]/invite', () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const request = new Request('https://example.com/api/boards/123/invite');
    const response = await POST(request, { params: Promise.resolve({ id: '123' }) });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('returns inviteUrl when authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1' } });
    const request = new Request('https://example.com/api/boards/123/invite');
    const response = await POST(request, { params: Promise.resolve({ id: '123' }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('inviteUrl', 'https://example.com/?boardId=123');
  });
}); 