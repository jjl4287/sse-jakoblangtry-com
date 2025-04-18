'use client';

import React from 'react';
import { Board } from '../board/Board';
import { BoardProvider } from '~/services/board-context';
import { ThemeProvider, useTheme } from '~/app/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export default function BoardLayout() {
  return (
    <BoardProvider>
      <ThemeProvider>
        <InnerBoardLayout />
      </ThemeProvider>
    </BoardProvider>
  );
}

const InnerBoardLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <div className="relative flex flex-col h-screen">
      <Board />
      <button
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="glass-morph-light shadow-sm p-2 rounded-full fixed bottom-4 left-4 z-50"
      >
        {theme === 'dark' ? (
          <Sun className="h-4 w-4 text-yellow-400" />
        ) : (
          <Moon className="h-4 w-4 text-blue-200" />
        )}
      </button>
    </div>
  );
};