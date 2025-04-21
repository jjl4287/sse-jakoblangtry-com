'use client';

import React, { useState, useRef, useCallback, memo, useMemo, useEffect } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import type { Column as ColumnType, Card as CardType } from '~/types';
import { Card } from './Card';
import { ExpandedCardModal } from './ExpandedCardModal';
import { CardAddForm } from './CardAddForm';
import { useBoard } from '~/services/board-context';
import { Trash2 } from 'lucide-react';

interface ColumnProps {
  column: ColumnType;
}

// Use memo to prevent unnecessary re-renders of columns that don't change
export const Column = memo(({ 
  column
}: ColumnProps) => {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const { updateColumn, deleteColumn } = useBoard();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(column.title);
  useEffect(() => {
    setTitleInput(column.title);
  }, [column.title]);
  // No container transforms to keep DnD preview aligned

  const handleAddCardClick = useCallback(() => {
    setIsAddingCard(true);
  }, []);
  
  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== column.title) {
      updateColumn(column.id, { title: titleInput.trim() }).catch(err => {
        console.error('Failed to update column title:', err);
        setTitleInput(column.title); // Reset to original title if update fails
      });
    } else {
      setTitleInput(column.title);
    }
  }, [titleInput, column.id, column.title, updateColumn]);
  
  const handleDeleteColumn = useCallback(() => {
    if (window.confirm('Are you sure you want to delete this column and all its cards?')) {
      deleteColumn(column.id).catch(err => console.error('Failed to delete column:', err));
    }
  }, [deleteColumn, column.id]);
  
  // Memoize sorted cards to avoid re-sorting on each render
  const sortedCards = useMemo(
    () => [...column.cards].sort((a, b) => a.order - b.order),
    [column.cards]
  );
  
  // --- JSX Rendering Starts Here ---
  
  return (
    <div
      className="flex flex-col h-full min-h-0 glass-column relative border rounded-lg shadow-md hover:shadow-lg overflow-visible p-2 min-w-[250px]"
    >
      <div className="flex items-center justify-between mb-4 flex-shrink-0 w-full">
        {isEditingTitle ? (
          <input
            type="text"
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') {
                setIsEditingTitle(false);
                setTitleInput(column.title);
              }
            }}
            className="text-lg font-semibold px-2 py-1 rounded border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
            autoFocus
          />
        ) : (
          <h3
            className="text-lg font-semibold hover:text-primary-light transition-colors cursor-text"
            onDoubleClick={() => setIsEditingTitle(true)}
          >
            {column.title}
          </h3>
        )}
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
          <button
            onClick={handleDeleteColumn}
            className="glass-morph-light text-xs p-1 rounded-full hover:bg-red-600/10 transition-colors hover-lift"
            aria-label="Delete Column"
          >
            <Trash2 className="h-4 w-4" />
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
            className="flex-1 overflow-y-auto overflow-x-visible min-h-0 p-2"
            style={{
              position: 'relative',
              margin: 0,
              minHeight: 0,
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
            {isAddingCard && (
              <CardAddForm columnId={column.id} onCancel={() => setIsAddingCard(false)} />
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
});

// Add display name for debugging purposes
Column.displayName = 'Column';