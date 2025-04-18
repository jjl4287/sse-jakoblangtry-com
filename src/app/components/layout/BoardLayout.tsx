'use client';

import React from 'react';
import { Board } from '../board/Board';
import { BoardProvider } from '~/services/board-context';
import { ThemeProvider } from '~/app/contexts/ThemeContext';

export default function BoardLayout() {
  return (
    <BoardProvider>
      <ThemeProvider>
        <div className="flex flex-col h-screen">
          <Board />
        </div>
      </ThemeProvider>
    </BoardProvider>
  );
}