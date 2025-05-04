// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, InviteMemberSchema } from '~/app/api/boards/[id]/members/route';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));

// Mock prisma
vi.mock('~/lib/prisma', () => ({
  default: {
    boardMember: {
      findMany: vi.fn(),
      create: vi.fn()
    },
    user: { upsert: vi.fn() }
  }
}));
import prisma from '~/lib/prisma';

describe('boards/[id]/members API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(new Request('https://example.com/api/boards/b1/members'), { params: Promise.resolve({ id: 'b1' }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('POST returns 400 on invalid email', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1' } });
    const badReq = new Request('https://example.com/api/boards/b1/members', { method: 'POST', body: JSON.stringify({ email: 'not-an-email' }) });
    const res = await POST(badReq, { params: Promise.resolve({ id: 'b1' }) });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid email' });
  });

  it('InviteMemberSchema parses valid email', () => {
    const data = { email: 'a@b.com' };
    expect(InviteMemberSchema.parse(data)).toEqual(data);
  });

  it('InviteMemberSchema throws on invalid email', () => {
    expect(() => InviteMemberSchema.parse({ email: 'nope' })).toThrow();
  });
}); 