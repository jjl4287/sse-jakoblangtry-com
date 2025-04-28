import { describe, it, expect } from 'vitest';
import { generateBoardMergePatch } from '~/services/merge-patch';
import type { Board, Column, Card } from '~/types';

// Helper to build a simple Board
function makeBoard(columns: Partial<Column>[]): Board {
  return {
    id: 'b1',
    title: 'Board',
    theme: 'light',
    columns: columns.map((c, i) => ({
      id: c.id ?? `col${i}`,
      title: c.title ?? (c.id ?? `col${i}`),
      width: c.width ?? 100,
      order: c.order ?? i,
      cards: (c.cards as Card[]) ?? [],
    })),
  };
}

describe('generateBoardMergePatch', () => {
  it('returns empty for identical boards', () => {
    const b1 = makeBoard([{ cards: [] }]);
    const b2 = makeBoard([{ cards: [] }]);
    const patch = generateBoardMergePatch(b1, b2);
    expect(patch).toEqual({});
  });

  it('detects title and theme change', () => {
    const base = makeBoard([{ cards: [] }]);
    const b2: Board = { ...base, title: 'New', theme: 'dark' };
    const patch = generateBoardMergePatch(base, b2);
    expect(patch).toEqual({ title: 'New', theme: 'dark' });
  });

  it('detects adding a column', () => {
    const c0 = { id: 'c0', cards: [] };
    const c1 = { id: 'c1', cards: [] };
    const b1 = makeBoard([c0]);
    const b2 = makeBoard([c0, c1]);
    const patch = generateBoardMergePatch(b1, b2);
    expect(patch.columns).toEqual([{ id: 'c1', title: 'c1', width: 100, order: 1 }]);
  });

  it('detects deleting a column', () => {
    const c0 = { id: 'c0', cards: [] };
    const c1 = { id: 'c1', cards: [] };
    const b1: Board = { id: 'b', title: 'B', theme: 'light', columns: [c0 as Column, c1 as Column] };
    const b2: Board = { ...b1, columns: [c0 as Column] };
    const patch = generateBoardMergePatch(b1, b2);
    expect(patch.columns).toContainEqual({ id: 'c1', _delete: true });
  });

  it('detects moving a card', () => {
    const cardA: Card = { id: 'a', title: 'A', description: '', labels: [], dueDate: undefined, assignees: [], priority: 'low', attachments: [], comments: [], columnId: 'col0', order: 0 };
    const cardB: Card = { id: 'b', title: 'B', description: '', labels: [], dueDate: undefined, assignees: [], priority: 'low', attachments: [], comments: [], columnId: 'col0', order: 1 };
    const col0: Column = { id: 'col0', title: 'C0', width: 100, order: 0, cards: [cardA, cardB] };
    const col1: Column = { id: 'col1', title: 'C1', width: 100, order: 1, cards: [] };
    const b1: Board = { id: 'b', title: 'B', theme: 'light', columns: [col0, col1] };
    // move A to second position in same column
    const movedA = { ...cardA, order: 1 } as Card;
    const b2: Board = { id: 'b', title: 'B', theme: 'light', columns: [{ ...col0, cards: [cardB, movedA] }, col1] };
    const patch = generateBoardMergePatch(b1, b2);
    expect(patch.cards).toContainEqual({ id: 'a', order: 1 });
  });
}); 