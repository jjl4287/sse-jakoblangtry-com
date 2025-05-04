import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '~/lib/prisma';
import { POST } from '~/app/api/cards/route'; // Adjust path if needed
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('~/lib/prisma', () => ({
  default: {
    card: {
      create: vi.fn(),
      findFirst: vi.fn(), // For fetching max order
      count: vi.fn(), // <-- Add mock for count
    },
  },
}));

describe('POST /api/cards', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create a card and return 201', async () => {
    const newCardData = {
      title: 'New Test Card',
      description: 'Card Description',
      columnId: 'col1',
      // Add other required fields as necessary based on schema
      priority: 'medium',
    };
    const mockCreatedCard = {
      id: 'card-new',
      ...newCardData,
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Include other relations if needed by response shape
      labels: [],
      assignees: [],
      comments: [],
      attachments: [],
    };

    // Mock finding max order
    (prisma.card.findFirst as any).mockResolvedValue({ order: 0 });
    // Mock successful creation
    (prisma.card.create as any).mockResolvedValue(mockCreatedCard);

    const request = new Request('https://test.com/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCardData),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual(expect.objectContaining({ title: 'New Test Card', order: 1 }));
    expect(prisma.card.findFirst).toHaveBeenCalledWith({
      where: { columnId: 'col1' },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    expect(prisma.card.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ 
        column: { connect: { id: newCardData.columnId } }, 
        title: newCardData.title, 
        description: newCardData.description, 
        priority: newCardData.priority, 
        order: 1,
      }),
      include: {
        labels: true,
        assignees: { select: { id: true, name: true, image: true } },
      }
    });
  });

  it('should return 400 if validation fails', async () => {
    const invalidCardData = {
      description: 'Missing title',
      columnId: 'col1',
    };

    const request = new Request('https://test.com/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidCardData),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.issues).toBeInstanceOf(Array);
    expect(body.issues[0].path).toContain('title');
    expect(prisma.card.create).not.toHaveBeenCalled();
  });

  it('should return 500 if database create fails', async () => {
    const newCardData = {
      title: 'Good Card',
      columnId: 'col1',
      priority: 'low',
    };

    (prisma.card.findFirst as any).mockResolvedValue(null); // Assume order starts at 0
    (prisma.card.create as any).mockRejectedValue(new Error('DB Error'));

    const request = new Request('https://test.com/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCardData),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to create card');
    expect(body.details).toBe('DB Error');
  });

  it('should handle case where findFirst returns null (first card in column)', async () => {
    const newCardData = {
      title: 'First Card',
      columnId: 'col-empty',
      priority: 'high',
    };
    const mockCreatedCard = { id: 'card-first', ...newCardData, order: 1 }; // Expect order 1

    (prisma.card.findFirst as any).mockResolvedValue(null); // No existing card
    (prisma.card.create as any).mockResolvedValue(mockCreatedCard);

    const url = 'https://test.com/api/cards'; // No query param needed for cards
    const request = new NextRequest(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCardData),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.order).toBe(1);
    expect(prisma.card.findFirst).toHaveBeenCalledWith({
      where: { columnId: 'col-empty' },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    expect(prisma.card.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ 
        column: { connect: { id: newCardData.columnId } }, 
        title: newCardData.title, 
        description: '', // Default description when not provided
        priority: newCardData.priority, 
        order: 1,
      }),
      include: {
        labels: true,
        assignees: { select: { id: true, name: true, image: true } },
      }
    });
  });
}); 