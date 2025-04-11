'use client';

import React from 'react';
import { Board } from '../board/Board';
import { BoardProvider } from '~/services/board-context';
import { ThemeProvider } from '~/app/contexts/ThemeContext';
import { DndContext } from '~/app/contexts/DndContext';

export const BoardLayout: React.FC = () => {
  return (
    <BoardProvider>
      <ThemeProvider>
        <DndContext>
          <div className="flex flex-col h-screen bg-[#4d4d4d]">
            <Board />
          </div>
        </DndContext>
      </ThemeProvider>
    </BoardProvider>
  );
}; 