'use client';

import React, { useState, useCallback, useMemo, useEffect, type CSSProperties, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Column as ColumnType } from '~/types';
import { useBoard } from '~/services/board-context';
import { SortableCard } from './SortableCard'; 
import { Trash2, Weight } from 'lucide-react';
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

interface SortableColumnProps {
  column: ColumnType;
  onAddCardClick: (columnId: string) => void;
  /** When true, renders as DragOverlay ghost */
  dragOverlay?: boolean;
  /** Optional style overrides when rendered in DragOverlay */
  overlayStyle?: React.CSSProperties;
}

export function SortableColumn({ column, dragOverlay = false, overlayStyle, onAddCardClick }: SortableColumnProps) {
  // Column.id is assumed valid (validated by parent Column wrapper)
  const { updateColumn, deleteColumn } = useBoard();
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
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: column.id,
    data: sortableColumnData,
    disabled: dragOverlay || isEditingTitle,
  });

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
  const startColumnEdit = () => {
    setIsEditingTitle(true);
    requestAnimationFrame(() => columnInputRef.current?.select());
  };
  
  // This will now just open the confirmation dialog
  const requestDeleteColumn = useCallback(() => {
    setIsDeleteConfirmOpen(true);
  }, []);

  // This function will be called by the confirmation dialog
  const executeDeleteColumn = useCallback(async () => {
    try {
      await deleteColumn(column.id);
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

  return (
    <div
      ref={setNodeRef}
      data-column-id={column.id}
      style={style}
      className="mx-2 flex flex-col flex-shrink h-full min-w-[250px] max-w-[350px] glass-column border rounded-lg shadow-md hover:shadow-lg overflow-visible p-2"
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center justify-between flex-shrink-0 mb-1 w-full h-7 px-1">
        <InlineEdit
          value={titleInput}
          onChange={val => setTitleInput(val)}
          isEditing={isEditingTitle}
          onEditStart={startColumnEdit}
          onSave={() => {
            setIsEditingTitle(false);
            if (titleInput.trim() && titleInput !== column.title) {
              const promise = updateColumn(column.id, { title: titleInput.trim() });
              if (promise && typeof promise.catch === 'function') {
                void promise.catch(err => {
                  console.error('Failed to update column title:', err);
                  setTitleInput(column.title); // Revert on error
                });
              }
            } else if (titleInput.trim() === '') {
              setTitleInput(column.title); // Revert if cleared
            }
          }}
          onCancel={() => {
            setIsEditingTitle(false);
            setTitleInput(column.title);
          }}
          className="text-lg font-semibold flex-1 min-w-0 mr-2"
          ref={columnInputRef}
          inputProps={{
            onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
              e.stopPropagation();
            }
          }}
          placeholder="Column Title"
        />
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">
            {column.cards.length} {column.cards.length === 1 ? 'card' : 'cards'}
          </span>
          {totalWeight > 0 && (
            <span className="text-xs text-muted-foreground flex items-center">
              <Weight className="h-3 w-3 mr-0.5" />
              {totalWeight}
            </span>
          )}
          <button
            onClick={() => onAddCardClick(column.id)}
            className="glass-morph-light text-xs p-1 rounded-full hover:bg-white/10 transition-colors hover-lift"
            aria-label="Add Card"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          <button
            onClick={requestDeleteColumn}
            className="glass-morph-light text-xs p-1 rounded-full hover:bg-red-600/10 transition-colors hover-lift"
            aria-label="Delete Column"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-visible min-h-[50px]">
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
        {sortedCards.length === 0 && (
          <div className={`empty-column-drop-area ${isOver ? 'drag-over' : ''}`}>
            <p className="text-sm text-white/50">Drop cards here</p>
          </div>
        )}
      </div>
      {/* Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the column "{column.title}"
              and all of its cards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteColumn} className="bg-red-600 hover:bg-red-700">
              Delete Column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 