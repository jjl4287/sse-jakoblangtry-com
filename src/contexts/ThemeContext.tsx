'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useBoard } from '~/services/board-context';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to dark as specified in the PRD
  const [theme, setThemeState] = useState<Theme>('dark');
  const { board, updateTheme } = useBoard();
  
  // Load theme from localStorage on first render
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    
    if (storedTheme) {
      setThemeState(storedTheme);
      
      // Sync with board state if available
      if (board && board.theme !== storedTheme) {
        updateTheme(storedTheme);
      }
    } else if (board) {
      // If no local storage but board has a theme, use that
      setThemeState(board.theme);
      localStorage.setItem('theme', board.theme);
    }
  }, [board]);
  
  // Apply theme class to document when theme changes
  useEffect(() => {
    // Remove both classes first
    document.documentElement.classList.remove('light', 'dark');
    // Add the current theme class
    document.documentElement.classList.add(theme);
  }, [theme]);
  
  // Set theme and save to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Also update the board's theme if available
    if (updateTheme) {
      updateTheme(newTheme);
    }
  };
  
  // Toggle between light and dark themes
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  };
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <div className={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}; 