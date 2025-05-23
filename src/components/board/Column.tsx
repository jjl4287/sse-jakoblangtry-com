'use client';

import React, { memo } from 'react';
import type { Column as ColumnType } from '~/types';
import { SortableColumn } from './SortableColumn';
import { Plus, Trash2, Weight } from 'lucide-react';

interface ColumnProps {
  column: ColumnType;
}

// This is a wrapper component for backwards compatibility
// It simply forwards to the SortableColumn component
export const Column = memo(({ column }: ColumnProps) => {
  if (!column?.id) {
    console.warn('Column component received undefined or invalid column data');
    return null;
  }

  // Calculate total weight for the column
  const totalWeight = column?.cards?.reduce((sum, card) => sum + (card.weight || 0), 0) || 0;

  // Just render the SortableColumn without the sortable functionality
  // For use in the DragOverlay or other non-sortable contexts
  return (
    <div className="mx-2 flex flex-col flex-shrink-0 h-full min-w-[250px] max-w-[350px] glass-column relative border rounded-lg shadow-md hover:shadow-lg overflow-visible p-2">
      <div className="flex items-center justify-between mb-2 flex-shrink-0 w-full">
        <h3 className="text-lg font-semibold flex-1 min-w-0 mr-2">{column?.title}</h3>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">
            {column?.cards?.length || 0} {(column?.cards?.length || 0) === 1 ? 'card' : 'cards'}
          </span>
          {totalWeight > 0 && (
            <span className="text-xs text-muted-foreground flex items-center">
              <Weight className="h-3 w-3 mr-0.5" />
              {totalWeight}
            </span>
          )}
          <button 
            className="p-1 rounded hover:bg-green-100 text-green-600 opacity-75 hover:opacity-100"
            title="Add Card"
            disabled
          >
            <Plus className="h-3 w-3" />
          </button>
          <button 
            className="p-1 rounded hover:bg-red-100 text-red-500 opacity-75 hover:opacity-100"
            title="Delete Column"
            disabled
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-visible min-h-[100px] p-2">
        {column?.cards?.map((card, index) => (
          card?.id ? (
            <div key={card.id} className="card-wrapper">
              <div className="relative glass-card p-2 cursor-pointer group border rounded-lg card-content">
                <h3 className="font-semibold text-sm mb-1">{card.title}</h3>
                {card.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2 whitespace-pre-wrap break-words truncate max-h-10 overflow-hidden">
                    {card.description}
                  </p>
                )}
              </div>
            </div>
              ) : null
            ))}
        
        {/* Empty column placeholder */}
        {(!column?.cards?.length) && (
          <div className="flex items-center justify-center h-24 text-sm text-muted-foreground/60 border-2 border-dashed border-muted-foreground/20 rounded-md">
            <span>Add a card to get started</span>
          </div>
        )}
      </div>
    </div>
  );
});

Column.displayName = 'Column';