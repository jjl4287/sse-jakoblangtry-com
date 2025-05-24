'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
// Theme context - removed board dependency

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Apply theme visual changes to the document
 * @param theme The theme to apply ('light' or 'dark')
 */
const applyThemeToDOM = (theme: Theme): void => {
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
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Default to dark as specified in the PRD
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Load theme from localStorage on first render
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    
    if (storedTheme) {
      setThemeState(storedTheme);
    }
    
    setIsInitialized(true);
  }, []); // Only run once on mount
  
  // Apply theme class to document when theme changes
  useEffect(() => {
    if (!isInitialized) return;
    applyThemeToDOM(theme);
  }, [theme, isInitialized]);
  
  // Set theme and save to localStorage
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);
  
  // Toggle between light and dark themes
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [theme, setTheme]);
  
  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    theme,
    toggleTheme,
    setTheme
  }), [theme, toggleTheme, setTheme]);
  
  return (
    <ThemeContext.Provider value={contextValue}>
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