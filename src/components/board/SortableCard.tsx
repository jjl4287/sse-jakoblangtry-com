'use client';

import React, { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from './Card';
import type { Card as CardType } from '~/types';

interface SortableCardProps {
  card: CardType;
  index: number;
  columnId: string;
  boardId?: string;
  deleteCard?: (cardId: string) => Promise<void> | void;
}

export function SortableCard({ card, index, columnId, boardId, deleteCard }: SortableCardProps) {
  const [isCardDetailsSheetOpen, setIsCardDetailsSheetOpen] = useState(false);

  // Check if card details sheet is open to disable dragging
  useEffect(() => {
    const checkSheetState = () => {
      const isOpen = document.documentElement.classList.contains('card-details-sheet-open');
      setIsCardDetailsSheetOpen(isOpen);
    };

    // Check initial state
    checkSheetState();

    // Watch for changes to the class
    const observer = new MutationObserver(() => {
      checkSheetState();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

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
    disabled: !card?.id || isCardDetailsSheetOpen // Disable when sheet is open
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
      className={`card-wrapper${isDragging ? ' dragging' : ''}${isCardDetailsSheetOpen ? ' sheet-open' : ''}`}
      {...attributes}
      {...(!isCardDetailsSheetOpen ? listeners : {})} // Only apply listeners when sheet is closed
    >
      <Card 
        card={card} 
        index={index} 
        columnId={columnId} 
        isDragging={isDragging}
        boardId={boardId}
        deleteCard={deleteCard}
      />
    </div>
  );
} 