'use client';

import React, { memo } from 'react';
import type { ReactNode } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface DndContextProps {
  children: ReactNode;
}

/**
 * DndContext provides the React-DnD drag and drop functionality to the application.
 * It wraps the children components with a DndProvider using the HTML5Backend.
 * 
 * @param children - The child components that require drag and drop functionality
 */
export const DndContext = memo(({ children }: DndContextProps) => {
  return (
    <DndProvider backend={HTML5Backend}>
      {children}
    </DndProvider>
  );
});

// Add display name for debugging and React DevTools
DndContext.displayName = 'DndContext'; 