/**
 * Constants for drag and drop operations
 */

// Item types
export const ItemTypes = {
  CARD: 'card',
};

// Drag item interfaces
export interface DragItem {
  type: string;
  id: string;
}

export interface CardDragItem extends DragItem {
  type: typeof ItemTypes.CARD;
  columnId: string;
  index: number;
  order: number;
} 