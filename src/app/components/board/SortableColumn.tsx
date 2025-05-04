'use client';

import React, { useState, useCallback, useMemo, useEffect, type CSSProperties, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Column as ColumnType, Label, Milestone, Card, Priority } from '~/types';
import { useBoard } from '~/services/board-context';
import { NewCardSheet } from './ui/NewCardSheet';
import { SortableCard } from './SortableCard'; 
import { Trash2 } from 'lucide-react';

// Define the type for the card data passed from NewCardSheet
// This should match the `CreateCardData` type in board-context.tsx
type CreateCardData = Partial<Omit<Card, 'id' | 'order' | 'columnId'>> & {
  title: string;
  columnId: string;
  order?: number; 
  assignees?: { connect: { id: string }[] };
  labels?: { connect: { id: string }[] };
};

interface SortableColumnProps {
  column: ColumnType;
  /** When true, renders as DragOverlay ghost */
  dragOverlay?: boolean;
  /** Optional style overrides when rendered in DragOverlay */
  overlayStyle?: React.CSSProperties;
}

export function SortableColumn({ column, dragOverlay = false, overlayStyle }: SortableColumnProps) {
  // Column.id is assumed valid (validated by parent Column wrapper)
  const [isNewCardSheetOpen, setIsNewCardSheetOpen] = useState(false);
  const { 
    updateColumn, 
    deleteColumn, 
    createCard, 
    boardMembers,
    milestones,
    labels,
  } = useBoard();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(column.title);
  
  useEffect(() => {
    setTitleInput(column.title);
  }, [column.title]);
  
  // Automatically start inline editing when a new column is added with placeholder title
  const inlineEditTriggered = useRef(false);
  useEffect(() => {
    if (!inlineEditTriggered.current && column.title === 'New Column') {
      setIsEditingTitle(true);
      inlineEditTriggered.current = true;
      // Auto-select the new placeholder title
      requestAnimationFrame(() => {
        columnInputRef.current?.select();
      });
    }
  }, [column.title]);
  
  // Memoize sortable data to prevent unstable object reference triggering continuous re-measure
  const sortableColumnData = useMemo(
    () => ({ type: 'column' as const, columnId: column.id, column }),
    [column]
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
    setIsNewCardSheetOpen(true);
  }, []);
  
  // Ref for column input selection
  const columnInputRef = useRef<HTMLInputElement>(null);

  // Handle column inline edit start
  const startColumnEdit = () => {
    setIsEditingTitle(true);
    // Select text after state update and render
    requestAnimationFrame(() => {
      columnInputRef.current?.select();
    });
  };
  
  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== column.title) {
      // Optimistic update; errors logged and title reset if needed
      const promise = updateColumn(column.id, { title: titleInput.trim() });
      if (promise && typeof promise.catch === 'function') {
        void promise.catch((err: Error) => {
          console.error('Failed to update column title:', err);
          setTitleInput(column.title);
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

  // Create a wrapper for the createCard function to match NewCardSheet's expectation
  const handleCreateCard = useCallback(async (cardData: CreateCardData) => {
    // The context createCard expects columnId as the first arg
    // cardData from NewCardSheet already includes necessary fields
    await createCard(column.id, cardData);
  }, [createCard, column.id]);

  return (
    <div
      ref={setNodeRef}
      data-column-id={column.id}
      style={style}
      className="mx-2 flex flex-col flex-shrink h-full min-w-[250px] max-w-[350px] glass-column border rounded-lg shadow-md hover:shadow-lg overflow-visible p-2"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between mb-4 flex-shrink-0 w-full h-7">
        {isEditingTitle ? (
          <input
            type="text"
            value={titleInput}
            onChange={e => setTitleInput(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === 'Escape') {
                setIsEditingTitle(false);
                setTitleInput(column.title);
              }
            }}
            className="flex-1 min-w-0 text-lg font-semibold bg-transparent border-b-2 border-transparent focus:border-foreground focus:outline-none mr-2 py-0 h-7 leading-tight"
            autoFocus
            ref={columnInputRef}
          />
        ) : (
          <h3
            className="flex-1 min-w-0 text-lg font-semibold border-b-2 border-transparent hover:text-primary-light transition-colors cursor-text mr-2 leading-tight truncate"
            onDoubleClick={startColumnEdit}
          >
            {column.title}
          </h3>
        )}
        <div className="flex items-center gap-1 ml-auto">
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
        {sortedCards.length === 0 && !isNewCardSheetOpen && (
          <div className={`empty-column-drop-area ${isOver ? 'drag-over' : ''}`}>
            <p className="text-sm text-white/50">Drop cards here</p>
          </div>
        )}
      </div>

      <NewCardSheet
        open={isNewCardSheetOpen}
        onOpenChange={setIsNewCardSheetOpen}
        columnId={column.id}
        boardMembers={boardMembers || []}
        milestones={milestones || []}
        labels={labels || []}
        onCreateCard={handleCreateCard}
      />
    </div>
  );
} 