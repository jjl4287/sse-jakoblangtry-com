import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '~/lib/prisma';
import { POST } from '~/app/api/columns/route'; // Adjust path if needed
import { NextRequest } from 'next/server'; // Import NextRequest

// Mock Prisma
vi.mock('~/lib/prisma', () => ({
  default: {
    column: {
      create: vi.fn(),
      findFirst: vi.fn(), // For fetching max order
    },
  },
}));

// Mock URLSearchParams - No longer needed as NextRequest handles URL parsing
// vi.mock('next/navigation', ...);

describe('POST /api/columns', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // mockSearchParams.get.mockReturnValue('proj1'); // No longer needed
  });

  it('should create a column and return 201', async () => {
    const newColumnData = {
      title: 'New Test Column',
      width: 200,
    };
    const mockCreatedColumn = {
      id: 'col-new',
      ...newColumnData,
      projectId: 'proj1',
      order: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock finding max order
    (prisma.column.findFirst as any).mockResolvedValue({ order: 0 });
    // Mock successful creation
    (prisma.column.create as any).mockResolvedValue(mockCreatedColumn);

    // Use NextRequest
    const url = 'https://test.com/api/columns?projectId=proj1';
    const request = new NextRequest(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newColumnData),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual(expect.objectContaining({ title: 'New Test Column', order: 1 }));
    expect(prisma.column.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'proj1' },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    expect(prisma.column.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...newColumnData, projectId: 'proj1', order: 1 }),
    });
  });

  it('should return 400 if validation fails (missing title)', async () => {
    const invalidColumnData = { width: 150 }; // Missing title

    // Use NextRequest
    const url = 'https://test.com/api/columns?projectId=proj1';
    const request = new NextRequest(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidColumnData),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.issues).toBeInstanceOf(Array);
    expect(body.issues[0].path).toContain('title');
    expect(prisma.column.create).not.toHaveBeenCalled();
  });

  it('should return 400 if projectId is missing', async () => {
    // mockSearchParams.get.mockReturnValue(null); // No longer needed
    const newColumnData = { title: 'Valid Title', width: 100 };

    // Use NextRequest with no query param
    const url = 'https://test.com/api/columns'; 
    const request = new NextRequest(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newColumnData),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Project ID is required');
    expect(prisma.column.create).not.toHaveBeenCalled();
  });

  it('should return 500 if database create fails', async () => {
    const newColumnData = { title: 'Good Column', width: 300 };

    (prisma.column.findFirst as any).mockResolvedValue(null); // Assume order starts at 0
    (prisma.column.create as any).mockRejectedValue(new Error('DB Error'));

    // Use NextRequest
    const url = 'https://test.com/api/columns?projectId=proj1';
    const request = new NextRequest(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newColumnData),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to create column');
    expect(body.details).toBe('DB Error');
  });

  it('should handle case where findFirst returns null (first column in project)', async () => {
    const newColumnData = { title: 'First Column', width: 250 };
    const mockCreatedColumn = { id: 'col-first', ...newColumnData, projectId: 'proj1', order: 1 }; // Expect order 1

    (prisma.column.findFirst as any).mockResolvedValue(null); // No existing column
    (prisma.column.create as any).mockResolvedValue(mockCreatedColumn);

    // Use NextRequest
    const url = 'https://test.com/api/columns?projectId=proj1';
    const request = new NextRequest(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newColumnData),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.order).toBe(1);
    expect(prisma.column.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'proj1' },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    expect(prisma.column.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...newColumnData, projectId: 'proj1', order: 1 }),
    });
  });
}); 