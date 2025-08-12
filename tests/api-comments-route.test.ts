import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '~/app/api/cards/[cardId]/comments/route';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));

vi.mock('~/lib/services/access-service', () => ({
  accessService: { canAccessCard: vi.fn() },
}));

vi.mock('~/lib/services/comment-service', () => ({
  commentService: {
    getCommentsByCardId: vi.fn(),
    createComment: vi.fn(),
  },
}));

import { accessService } from '~/lib/services/access-service';
import { commentService } from '~/lib/services/comment-service';

describe('/api/cards/[cardId]/comments', () => {
  const mockGetSession = getServerSession as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
  });

  it('lists comments for a card', async () => {
    accessService.canAccessCard.mockResolvedValueOnce(true);
    commentService.getCommentsByCardId.mockResolvedValueOnce([]);
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ cardId: 'c1' }) } as any);
    expect(res.status).toBe(200);
  });

  it('creates a comment', async () => {
    accessService.canAccessCard.mockResolvedValueOnce(true);
    commentService.createComment.mockResolvedValueOnce({ id: 'cm1', content: 'hello', user: { id: 'u1' } });
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ content: 'hello' }) });
    const res = await POST(req, { params: Promise.resolve({ cardId: 'c1' }) } as any);
    expect(res.status).toBe(201);
  });
});

