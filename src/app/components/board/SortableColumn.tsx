'use client';

import React, { useState, useCallback, useMemo, useEffect, type CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Column as ColumnType } from '~/types';
import { useBoard } from '~/services/board-context';
import { CardAddForm } from './CardAddForm';
import { SortableCard } from './SortableCard'; 
import { Trash2 } from 'lucide-react';

interface SortableColumnProps {
  column: ColumnType;
  /** When true, renders as DragOverlay ghost */
  dragOverlay?: boolean;
  /** Optional style overrides when rendered in DragOverlay */
  overlayStyle?: React.CSSProperties;
}

export function SortableColumn({ column, dragOverlay = false, overlayStyle }: SortableColumnProps) {
  // Column.id is assumed valid (validated by parent Column wrapper)
  const [isAddingCard, setIsAddingCard] = useState(false);
  const { updateColumn, deleteColumn } = useBoard();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(column.title);
  
  useEffect(() => {
    setTitleInput(column.title);
  }, [column.title]);
  
  // Memoize sortable data to prevent unstable object reference triggering continuous re-measure
  const sortableColumnData = useMemo(
    () => ({ type: 'column' as const, columnId: column.id }),
    [column.id]
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: column.id,
    data: sortableColumnData,
    disabled: dragOverlay,
  });

  // Compute style: apply transforms only in-list; for overlay, merge optional overlayStyle overrides
  const style: CSSProperties = dragOverlay
    ? { opacity: 1, ...overlayStyle }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      };

  const handleAddCardClick = useCallback(() => {
    setIsAddingCard(true);
  }, []);
  
  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== column.title) {
      const updatePromise = updateColumn(column.id, { title: titleInput.trim() });
      if (updatePromise) {
        updatePromise.catch((err: Error) => {
          console.error('Failed to update column title:', err);
          setTitleInput(column.title); // Reset to original title if update fails
        });
      }
    } else {
      setTitleInput(column.title);
    }
  }, [titleInput, column.id, column.title, updateColumn]);
  
  const handleDeleteColumn = useCallback(async () => {
    if (confirm('Are you sure you want to delete this column?')) {
      try {
        await deleteColumn(column.id);
      } catch (error: unknown) {
        console.error('Failed to delete column:', error);
      }
    }
  }, [deleteColumn, column.id]);
  
  // Memoize sorted cards to avoid re-sorting on each render
  const sortedCards = useMemo(
    () => {
      // Ensure column.cards exists and is an array before sorting
      if (!column.cards || !Array.isArray(column.cards)) {
        console.warn(`Column ${column.id} has no cards array`);
        return [];
      }
      return [...column.cards].sort((a, b) => a.order - b.order);
    },
    [column.cards, column.id]
  );

  // Get sortable card IDs 
  const cardIds = useMemo(() => 
    sortedCards.map(card => card.id), 
    [sortedCards]
  );
  
  return (
    <div
      ref={setNodeRef}
      data-column-id={column.id}
      style={style}
      className="mx-2 flex flex-col flex-shrink-0 h-full min-w-[250px] max-w-[350px] glass-column border rounded-lg shadow-md hover:shadow-lg overflow-visible p-2"
      {...attributes}
      {...listeners}
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
      
      <div className="flex-1 overflow-y-auto overflow-x-visible min-h-[100px] p-2">
        <SortableContext 
          items={cardIds}
          strategy={verticalListSortingStrategy}
        >
          {sortedCards.map((card, index) => (
            card?.id && (
              <SortableCard 
                key={card.id} 
                card={card} 
                index={index} 
                columnId={column.id} 
              />
            )
          ))}
        </SortableContext>
        
        {/* Empty column drop target to ensure we can drop into empty columns */}
        {sortedCards.length === 0 && !isAddingCard && (
          <div className={`empty-column-drop-area ${isOver ? 'drag-over' : ''}`}>
            <p className="text-sm text-white/50">Drop cards here</p>
          </div>
        )}
        
        {isAddingCard && (
          <CardAddForm columnId={column.id} onCancel={() => setIsAddingCard(false)} />
        )}
      </div>
    </div>
  );
} 