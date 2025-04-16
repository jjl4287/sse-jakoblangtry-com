'use client';

import React from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';

export const Header: React.FC = () => {
  return (
    <header className="glass-column border rounded-lg banner-padding mb-1 mx-2 mt-2 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
      <div className="flex flex-col">
        <h1 className="text-xl font-bold text-white">Glassmorphic Kanban</h1>
        <p className="text-xs text-white/70">Organize your tasks beautifully</p>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
}; 