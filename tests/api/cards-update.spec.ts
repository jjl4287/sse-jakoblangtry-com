// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { CardUpdateSchema } from '~/app/api/cards/[id]/route';

describe('CardUpdateSchema', () => {
  it('accepts valid fields', () => {
    const data = {
      title: 'New title',
      description: 'Desc',
      dueDate: '2023-01-01',
      priority: 'high',
      order: 2,
      labels: [{ id: 'l1', name: 'Label', color: '#fff' }],
      assignees: ['u1', 'u2'],
      milestoneId: 'm1'
    };
    expect(CardUpdateSchema.parse(data)).toEqual(data);
  });

  it('rejects invalid priority', () => {
    expect(() => CardUpdateSchema.parse({ priority: 'urgent' })).toThrow();
  });

  it('rejects non-string assignees', () => {
    expect(() => CardUpdateSchema.parse({ assignees: [123] })).toThrow();
  });

  it('rejects non-array labels', () => {
    expect(() => CardUpdateSchema.parse({ labels: 'not an array' })).toThrow();
  });
}); 