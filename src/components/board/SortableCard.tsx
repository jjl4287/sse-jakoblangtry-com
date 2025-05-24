'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from './Card';
import type { Card as CardType } from '~/types';

interface SortableCardProps {
  card: CardType;
  index: number;
  columnId: string;
  boardId?: string;
}

export function SortableCard({ card, index, columnId, boardId }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card?.id || `temp-${Math.random()}`,
    data: {
      type: 'card',
      card,
      index,
      columnId
    },
    disabled: !card?.id
  });

  // Early return with fallback if card is undefined
  if (!card?.id) {
    console.warn('SortableCard component received undefined or invalid card data');
    return null;
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    position: 'relative',
    willChange: 'transform, opacity',
  };

  return (
    <div
      ref={setNodeRef}
      style={style as React.CSSProperties}
      className={`card-wrapper${isDragging ? ' dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <Card 
        card={card} 
        index={index} 
        columnId={columnId} 
        isDragging={isDragging}
        boardId={boardId}
      />
    </div>
  );
} 