// Generate minimal JSON Merge Patch for the Board shape
import type { Board, Column, Card } from '~/types';

interface ColumnPatch {
  id: string;
  title?: string;
  width?: number;
  order?: number;
  _delete?: boolean;
}
interface CardPatch {
  id: string;
  columnId?: string;
  order?: number;
  title?: string;
  description?: string;
  _delete?: boolean;
}

/**
 * Compares two boards and returns a JSON Merge Patch object
 * containing only the changed fields.
 */
export function generateBoardMergePatch(oldB: Board, newB: Board) {
  const patch: Partial<{ title: Board['title']; theme: Board['theme']; columns: ColumnPatch[]; cards: CardPatch[] }> = {};

  // Top-level title/theme
  if (oldB.title !== newB.title) patch.title = newB.title;
  if (oldB.theme !== newB.theme) patch.theme = newB.theme;

  // Columns: detect deletes and updates
  const deletedCols = oldB.columns
    .filter(c => !newB.columns.find(nc => nc.id === c.id))
    .map(c => ({ id: c.id, _delete: true }));
  const updatedCols = newB.columns
    .map(nc => {
      const oc = oldB.columns.find(c => c.id === nc.id);
      if (!oc) {
        // new column
        return { id: nc.id, title: nc.title, width: nc.width, order: nc.order } as ColumnPatch;
      }
      const delta: ColumnPatch = { id: nc.id };
      if (oc.title !== nc.title) delta.title = nc.title;
      if (oc.width !== nc.width) delta.width = nc.width;
      if (oc.order !== nc.order) delta.order = nc.order;
      return Object.keys(delta).length > 1 ? delta : null;
    })
    .filter((x): x is ColumnPatch => x !== null);
  const colsPatch = [...updatedCols, ...deletedCols];
  if (colsPatch.length) patch.columns = colsPatch;

  // Cards: detect deletes and moves
  const oldCards = oldB.columns.flatMap(c => c.cards);
  const newCards = newB.columns.flatMap(c => c.cards);
  const deletedCards = oldCards
    .filter(c => !newCards.find(nc => nc.id === c.id))
    .map(c => ({ id: c.id, _delete: true }));
  const updatedCards = newCards
    .map(nc => {
      const oc = oldCards.find(c => c.id === nc.id);
      if (!oc) {
        // new card or moved
        return { id: nc.id, columnId: nc.columnId, order: nc.order } as CardPatch;
      }
      const delta: CardPatch = { id: nc.id };
      if (oc.columnId !== nc.columnId) delta.columnId = nc.columnId;
      if (oc.order !== nc.order) delta.order = nc.order;
      return Object.keys(delta).length > 1 ? delta : null;
    })
    .filter((x): x is CardPatch => x !== null);
  const cardsPatch = [...updatedCards, ...deletedCards];
  if (cardsPatch.length) patch.cards = cardsPatch;

  return patch;
} 