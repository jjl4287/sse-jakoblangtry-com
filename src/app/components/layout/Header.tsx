'use client';

import React from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';

export const Header: React.FC = () => {
  return (
    <header className="bg-primary/30 backdrop-blur-lg border-b border-white/10">
      <div className="container mx-auto px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white">Glassmorphic Kanban</h1>
          <p className="text-xs text-white/70">Organize your tasks beautifully</p>
        </div>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}; 