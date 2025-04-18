'use client';

import React, { useState, useRef, useCallback, memo, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import type { Column as ColumnType, Card as CardType } from '~/types';
import { Card } from './Card';
import { ExpandedCardModal } from './ExpandedCardModal';

interface ColumnProps {
  column: ColumnType;
}

// Use memo to prevent unnecessary re-renders of columns that don't change
export const Column = memo(({ 
  column
}: ColumnProps) => {
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  // No container transforms to keep DnD preview aligned

  const handleAddCardClick = useCallback(() => {
    setIsCardModalOpen(true);
  }, []);
  
  // Memoize sorted cards to avoid re-sorting on each render
  const sortedCards = useMemo(
    () => [...column.cards].sort((a, b) => a.order - b.order),
    [column.cards]
  );
  
  // --- JSX Rendering Starts Here ---
  
  return (
    <div
      className="flex flex-col h-full glass-column relative border rounded-lg shadow-md hover:shadow-lg overflow-visible"
      style={{
        width: `${column.width}%`,
        padding: '0.75rem',
        margin: '3px 0.25rem',
        overflow: 'visible',
      }}
    >
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold hover:text-primary-light transition-colors">{column.title}</h3>
        <div className="flex items-center gap-2">
          <span className="glass-morph-light text-xs px-2 py-1 rounded-full">
            {column.cards.length}
          </span>
          <button 
            onClick={handleAddCardClick}
            className="glass-morph-light text-xs p-1 rounded-full hover:bg-white/10 transition-colors hover-lift"
            aria-label="Add Card"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>
      
      <Droppable
        droppableId={column.id}
        type="CARD"
        renderClone={(providedClone, snapshotClone, rubric) => {
          const cloneCard = sortedCards[rubric.source.index]!;
          return (
            <div
              ref={providedClone.innerRef}
              {...providedClone.draggableProps}
              {...providedClone.dragHandleProps}
              style={{ ...providedClone.draggableProps.style, zIndex: 9999, position: 'fixed', margin: 0, padding: 0 }}
              className="card-wrapper"
            >
              <Card card={cloneCard} index={rubric.source.index} columnId={column.id} />
            </div>
          );
        }}
      >
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex-1 overflow-y-auto overflow-x-visible px-0.5"
            style={{
              position: 'relative',
              marginLeft: '-2px',
              marginRight: '-2px',
              paddingTop: '4px',
              paddingBottom: '4px',
            }}
          >
            {sortedCards.map((card, index) => (
              <Draggable key={card.id} draggableId={card.id} index={index}>
                {(provided, snapshot) => {
                  const style: React.CSSProperties = {
                    ...provided.draggableProps.style,
                    opacity: snapshot.isDragging ? 0 : 1,
                  };
                  return (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={style}
                      className="card-wrapper"
                    >
                      <Card card={card} index={index} columnId={column.id} />
                    </div>
                  );
                }}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      
      {/* New Card Modal */}
      {isCardModalOpen && (
        <ExpandedCardModal
          columnId={column.id}
          isOpen={isCardModalOpen}
          onOpenChange={setIsCardModalOpen}
        />
      )}
    </div>
  );
});

// Add display name for debugging purposes
Column.displayName = 'Column';

// Placeholder component removed; DnD placeholder handles spacing 