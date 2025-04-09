import { z } from 'zod';

/**
 * Zod schemas for validating data model objects
 */

// Label schema
export const LabelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
});

// Attachment schema
export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  url: z.string().url(),
  type: z.string(),
  createdAt: z.coerce.date(),
});

// Comment schema
export const CommentSchema = z.object({
  id: z.string().uuid(),
  author: z.string().min(1),
  content: z.string().min(1),
  createdAt: z.coerce.date(),
});

// Card schema
export const CardSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  description: z.string(),
  labels: z.array(LabelSchema),
  dueDate: z.coerce.date().optional(),
  assignees: z.array(z.string()),
  priority: z.enum(['low', 'medium', 'high']),
  attachments: z.array(AttachmentSchema),
  comments: z.array(CommentSchema),
  columnId: z.string().uuid(),
  order: z.number().int().nonnegative(),
});

// Column schema
export const ColumnSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(50),
  width: z.number().positive(),
  cards: z.array(CardSchema),
});

// Board schema
export const BoardSchema = z.object({
  columns: z.array(ColumnSchema),
  theme: z.enum(['light', 'dark']),
});

// Type inference helpers
export type LabelSchemaType = z.infer<typeof LabelSchema>;
export type AttachmentSchemaType = z.infer<typeof AttachmentSchema>;
export type CommentSchemaType = z.infer<typeof CommentSchema>;
export type CardSchemaType = z.infer<typeof CardSchema>;
export type ColumnSchemaType = z.infer<typeof ColumnSchema>;
export type BoardSchemaType = z.infer<typeof BoardSchema>; 