'use client';

import React from 'react';
import { Header } from './Header';
import { Board } from '../board/Board';
import { BoardProvider } from '~/services/board-context';
import { ThemeProvider } from '~/app/contexts/ThemeContext';
import { DndContext } from '~/app/contexts/DndContext';

export const BoardLayout: React.FC = () => {
  return (
    <BoardProvider>
      <ThemeProvider>
        <DndContext>
          <div className="flex flex-col h-screen bg-gradient-to-br dark:from-primary dark:to-secondary light:from-[#f8f9fa] light:to-gray-100">
            <Header />
            <Board />
          </div>
        </DndContext>
      </ThemeProvider>
    </BoardProvider>
  );
}; 