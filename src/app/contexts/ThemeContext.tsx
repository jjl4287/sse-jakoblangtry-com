'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
  const [isInitialized, setIsInitialized] = useState(false);
  const { board, updateTheme } = useBoard();
  
  // Load theme from localStorage on first render
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    
    if (storedTheme) {
      setThemeState(storedTheme);
      
      // Sync with board state if available
      if (board && board.theme !== storedTheme) {
        updateTheme(storedTheme).catch(err => 
          console.error('Error syncing theme with board:', err)
        );
      }
    } else if (board) {
      // If no local storage but board has a theme, use that
      setThemeState(board.theme);
      localStorage.setItem('theme', board.theme);
    }
    
    setIsInitialized(true);
  }, [board]);
  
  // Apply theme class to document when theme changes
  useEffect(() => {
    if (!isInitialized) return;
    
    // Remove both classes first
    document.documentElement.classList.remove('light', 'dark');
    // Add the current theme class
    document.documentElement.classList.add(theme);
    
    // Set body class for component specific styling
    if (theme === 'light') {
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    } else {
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    }
    
    // Update CSS variables for theme-specific styles
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--bg-color', '#000000');
      document.documentElement.style.setProperty('--text-color', '#ffffff');
    } else {
      document.documentElement.style.setProperty('--bg-color', '#f8f9fa');
      document.documentElement.style.setProperty('--text-color', '#212529');
    }
  }, [theme, isInitialized]);
  
  // Set theme and save to localStorage
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Also update the board's theme if available
    if (updateTheme) {
      updateTheme(newTheme).catch(err => 
        console.error('Error updating theme:', err)
      );
    }
  }, [updateTheme]);
  
  // Toggle between light and dark themes
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
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