'use client';

import React, { useState, useCallback, useMemo, useEffect, type CSSProperties, useRef, memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Column as ColumnType, ColumnUpdate } from '~/types';
import { useColumn, useColumnMutations } from '~/hooks/useColumn';
import { SortableCard } from './SortableCard'; 
import { Trash2, Weight, Plus } from 'lucide-react';
import { InlineEdit } from '~/components/ui/InlineEdit';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { getColumnColorClass } from '~/lib/utils';

interface SortableColumnProps {
  column: ColumnType;
  onAddCardClick: (columnId: string) => void;
  /** When true, renders as DragOverlay ghost */
  dragOverlay?: boolean;
  /** Optional style overrides when rendered in DragOverlay */
  overlayStyle?: React.CSSProperties;
  boardId?: string;
  /** Optimized mutation functions */
  updateColumn?: (columnId: string, updates: ColumnUpdate) => Promise<void>;
  deleteColumn?: (columnId: string) => Promise<void>;
  deleteCard?: (cardId: string) => Promise<void> | void; // Optimized card deletion function
}

export const SortableColumn = memo<SortableColumnProps>(function SortableColumn({ 
  column, 
  dragOverlay = false, 
  overlayStyle, 
  onAddCardClick, 
  boardId,
  updateColumn: optimizedUpdateColumn,
  deleteColumn: optimizedDeleteColumn,
  deleteCard
}) {
  // Column.id is assumed valid (validated by parent Column wrapper)
  const { updateColumn: fallbackUpdateColumn, deleteColumn: fallbackDeleteColumn } = useColumnMutations();
  
  // Use optimized mutations if available, otherwise fall back to traditional hooks
  const updateColumn = optimizedUpdateColumn || fallbackUpdateColumn;
  const deleteColumn = optimizedDeleteColumn || fallbackDeleteColumn;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(column.title);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
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
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    data: sortableColumnData,
    disabled: dragOverlay || isEditingTitle,
  });

  // Also make the column droppable for cards
  const {
    setNodeRef: setDroppableNodeRef,
    isOver,
  } = useDroppable({
    id: column.id,
    data: { type: 'column', columnId: column.id },
  });

  // Combine refs for both sortable and droppable
  const setNodeRef = useCallback((node: HTMLElement | null) => {
    setSortableNodeRef(node);
    setDroppableNodeRef(node);
  }, [setSortableNodeRef, setDroppableNodeRef]);

  // Compute style: apply transforms only in-list; for overlay, merge optional overlayStyle overrides
  const style: CSSProperties = dragOverlay
    ? { opacity: 1, ...overlayStyle }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      };

  // Ref for column input selection
  const columnInputRef = useRef<HTMLInputElement>(null);

  // Handle column inline edit start
  const startColumnEdit = useCallback(() => {
    setIsEditingTitle(true);
    requestAnimationFrame(() => columnInputRef.current?.select());
  }, []);
  
  // This will now just open the confirmation dialog
  const requestDeleteColumn = useCallback(() => {
    setIsDeleteConfirmOpen(true);
  }, []);

  // This function will be called by the confirmation dialog
  const executeDeleteColumn = useCallback(async () => {
    try {
      const result = deleteColumn(column.id);
      // If it returns a promise (traditional hook), wait for it
      if (result && typeof result.then === 'function') {
        await result;
      }
      // If it's optimized mutation (void return), it handles success/error internally
    } catch (error: unknown) {
      console.error('Failed to delete column:', error);
      // Optionally, show a toast or error message to the user here
    }
    setIsDeleteConfirmOpen(false); // Close dialog regardless of outcome
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

  // Calculate total weight for the column
  const totalWeight = useMemo(() => {
    return sortedCards.reduce((sum, card) => sum + (card.weight || 0), 0);
  }, [sortedCards]);

  // Get sortable card IDs 
  const cardIds = useMemo(() => 
    sortedCards.map(card => card.id), 
    [sortedCards]
  );

  // Memoized handlers to prevent recreation
  const handleSaveTitle = useCallback(async () => {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== column.title) {
      try {
        const result = updateColumn(column.id, { title: titleInput.trim() });
        // If it returns a promise (traditional hook), wait for it and handle errors
        if (result && typeof result.then === 'function') {
          await result;
        }
        // If it's optimized mutation (void return), it handles errors internally
      } catch (error) {
        console.error('Failed to update column title:', error);
        setTitleInput(column.title); // Revert on error
      }
    } else if (titleInput.trim() === '') {
      setTitleInput(column.title); // Revert if cleared
    }
  }, [titleInput, column.title, column.id, updateColumn]);

  const handleCancelTitle = useCallback(() => {
    setIsEditingTitle(false);
    setTitleInput(column.title);
  }, [column.title]);

  const handleAddClick = useCallback(() => {
    onAddCardClick(column.id);
  }, [onAddCardClick, column.id]);

  // Get consistent color class for this column
  const columnColorClass = getColumnColorClass(column.id);

  return (
    <>
      <div
        ref={setNodeRef}
        data-column-id={column.id}
        style={style}
        className={`mx-2 flex flex-col flex-shrink h-full min-w-[250px] max-w-[350px] glass-column ${columnColorClass} border rounded-lg shadow-md hover:shadow-lg overflow-visible p-2`}
        {...attributes}
        {...listeners}
      >
        <div className="flex items-center justify-between flex-shrink-0 mb-1 w-full h-7 px-1">
          <InlineEdit
            value={titleInput}
            onChange={val => setTitleInput(val)}
            isEditing={isEditingTitle}
            onEditStart={startColumnEdit}
            onSave={handleSaveTitle}
            onCancel={handleCancelTitle}
            className="text-lg font-semibold flex-1 min-w-0 mr-2"
            ref={columnInputRef}
            inputProps={{
              onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                e.stopPropagation();
              }
            }}
            placeholder="Column Title"
          />
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-muted-foreground">
              {column.cards.length} {column.cards.length === 1 ? 'card' : 'cards'}
            </span>
            {totalWeight > 0 && (
              <span className="text-xs text-muted-foreground flex items-center">
                <Weight className="h-3 w-3 mr-0.5" />
                {totalWeight}
              </span>
            )}
            <div className="flex items-center gap-0.5">
              <button 
                onClick={handleAddClick}
                className="px-2 py-1.5 rounded-md hover:bg-muted text-foreground hover:text-foreground transition-colors font-medium"
                title="Add Card"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button 
                onClick={requestDeleteColumn}
                className="px-2 py-1.5 rounded-md hover:bg-muted text-foreground hover:text-foreground transition-colors font-medium"
                title="Delete Column"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Cards */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
            {sortedCards.map((card, index) => (
              <SortableCard 
                key={card.id} 
                card={card} 
                index={index} 
                columnId={column.id}
                boardId={boardId}
                deleteCard={deleteCard}
              />
            ))}
          </SortableContext>
          
          {/* Empty column placeholder */}
          {sortedCards.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 p-4">
              {/* Professional Empty State SVG for column */}
              <div className="mb-3">
                <svg 
                  width="48" 
                  height="48" 
                  viewBox="0 0 48 48" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  className="opacity-40"
                >
                  {/* Card representation */}
                  <g className="text-muted-foreground">
                    {/* Stack of cards */}
                    <rect x="8" y="14" width="28" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" className="opacity-60" />
                    <rect x="10" y="12" width="28" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" className="opacity-40" />
                    <rect x="12" y="10" width="28" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" className="opacity-20" />
                    
                    {/* Plus icon */}
                    <circle cx="24" cy="20" r="6" fill="currentColor" className="text-primary/30" />
                    <path d="M21 20h6M24 17v6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
              
              {/* Empty state content */}
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                No cards yet
              </p>
              <button 
                onClick={handleAddClick}
                className="mt-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Add your first card
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Column</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this column? This action cannot be undone and will also delete all cards in this column.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteColumn} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});