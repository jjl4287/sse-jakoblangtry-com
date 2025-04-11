'use client';

import React from 'react';
import { ThemeToggle } from '../ui/ThemeToggle';

export const Header: React.FC = () => {
  return (
    <header className="relative border rounded-lg shadow-md hover:shadow-lg 
                     dark:bg-[rgba(10,54,34,var(--glass-bg-opacity-dark))] 
                     dark:border-[rgba(255,255,255,var(--glass-border-opacity-dark))] 
                     bg-[rgba(255,255,255,var(--glass-bg-opacity-light))] 
                     border-[rgba(210,220,230,var(--glass-border-opacity-light))] 
                     [backdrop-filter:blur(var(--glass-blur))] 
                     dark:hover:bg-[rgba(10,54,34,var(--glass-hover-bg-opacity-dark))] 
                     dark:hover:border-[rgba(255,255,255,var(--glass-hover-border-opacity-dark))] 
                     hover:bg-[rgba(255,255,255,var(--glass-hover-bg-opacity-light))] 
                     hover:border-[rgba(210,220,230,var(--glass-hover-border-opacity-light))] 
                     transition-colors duration-300 ease-in-out ">
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