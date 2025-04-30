'use client';

import React, { memo } from 'react';
import type { Column as ColumnType } from '~/types';
import { SortableColumn } from './SortableColumn';

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

  // Just render the SortableColumn without the sortable functionality
  // For use in the DragOverlay or other non-sortable contexts
  return (
    <div className="flex flex-col h-full flex-1 min-w-[250px] max-w-[350px] mx-2 glass-column relative border rounded-lg shadow-md hover:shadow-lg overflow-visible p-2">
      <div className="flex items-center justify-between mb-4 flex-shrink-0 w-full">
        <h3 className="text-lg font-semibold">{column?.title}</h3>
        <div className="flex items-center gap-2">
          <span className="glass-morph-light text-xs px-2 py-1 rounded-full">
            {column?.cards?.length || 0}
          </span>
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
        
        {/* Empty column placeholder that matches the droppable styling */}
        {(!column?.cards?.length) && (
          <div className="empty-column-drop-area">
            <p className="text-sm text-white/50">Drop cards here</p>
          </div>
        )}
      </div>
    </div>
  );
});

Column.displayName = 'Column';