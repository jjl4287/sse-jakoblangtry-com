import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '~/app/api/cards/[cardId]/attachments/route';
import { getServerSession } from 'next-auth/next';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));

vi.mock('~/lib/services/access-service', () => ({
  accessService: { canAccessCard: vi.fn() },
}));

vi.mock('~/lib/services/attachment-service', () => ({
  attachmentService: {
    getAttachmentsByCardId: vi.fn(),
    createAttachment: vi.fn(),
  },
}));

import { accessService } from '~/lib/services/access-service';
import { attachmentService } from '~/lib/services/attachment-service';

describe('/api/cards/[cardId]/attachments', () => {
  const mockGetSession = getServerSession as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: 'u1' } });
  });

  it('lists attachments for a card', async () => {
    accessService.canAccessCard.mockResolvedValueOnce(true);
    attachmentService.getAttachmentsByCardId.mockResolvedValueOnce([]);
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ cardId: 'c1' }) });
    expect(res.status).toBe(200);
  });

  it('creates a link attachment via JSON', async () => {
    accessService.canAccessCard.mockResolvedValueOnce(true);
    attachmentService.createAttachment.mockResolvedValueOnce({ id: 'a1', name: 'Example', url: 'https://ex.com', type: 'link' });
    const req = new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'https://ex.com', name: 'Example' }) });
    const res = await POST(req, { params: Promise.resolve({ cardId: 'c1' }) });
    expect(res.status).toBe(201);
  });
});

