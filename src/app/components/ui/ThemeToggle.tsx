'use client';

import React from 'react';
import { useTheme } from '~/app/contexts/ThemeContext';
import { motion } from 'framer-motion';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <motion.button
      onClick={toggleTheme}
      className="relative inline-flex items-center justify-center rounded-full w-16 h-8 
                 px-1 py-1 border shadow-md hover:shadow-lg 
                 dark:bg-[rgba(10,54,34,var(--glass-bg-opacity-dark))] 
                 dark:border-[rgba(255,255,255,var(--glass-border-opacity-dark))] 
                 bg-[rgba(255,255,255,var(--glass-bg-opacity-light))] 
                 border-[rgba(210,220,230,var(--glass-border-opacity-light))] 
                 [backdrop-filter:blur(var(--glass-blur))] 
                 dark:hover:bg-[rgba(10,54,34,var(--glass-hover-bg-opacity-dark))] 
                 dark:hover:border-[rgba(255,255,255,var(--glass-hover-border-opacity-dark))] 
                 hover:bg-[rgba(255,255,255,var(--glass-hover-bg-opacity-light))] 
                 hover:border-[rgba(210,220,230,var(--glass-hover-border-opacity-light))] 
                 transition-colors duration-300 ease-in-out 
                 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-opacity-50"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      whileTap={{ scale: 0.95 }}
    >
      <span className="sr-only">Toggle theme</span>
      
      {/* Track and icons background */}
      <span className="absolute inset-0 rounded-full overflow-hidden">
        <span className={`absolute inset-0 rounded-full transition-colors duration-300 ${
          theme === 'dark' ? 'bg-[rgba(10,54,34,0.4)]' : 'bg-[rgba(10,54,34,0.2)]'
        }`} />
      </span>
      
      {/* Sun icon (visible in dark mode) */}
      <motion.svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="absolute left-2 w-4 h-4 text-yellow-300"
        viewBox="0 0 20 20" 
        fill="currentColor"
        initial={{ opacity: theme === 'dark' ? 1 : 0 }}
        animate={{ opacity: theme === 'dark' ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <path 
          fillRule="evenodd" 
          d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" 
          clipRule="evenodd" 
        />
      </motion.svg>
      
      {/* Moon icon (visible in light mode) */}
      <motion.svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="absolute right-2 w-4 h-4 text-blue-200"
        viewBox="0 0 20 20" 
        fill="currentColor"
        initial={{ opacity: theme === 'light' ? 1 : 0 }}
        animate={{ opacity: theme === 'light' ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <path 
          d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" 
        />
      </motion.svg>
      
      {/* Toggle slider */}
      <motion.div
        className="absolute w-6 h-6 rounded-full shadow-md flex items-center justify-center"
        style={{
          background: theme === 'dark' 
            ? 'linear-gradient(to bottom right, #0A3622, #1A7F56)' 
            : 'linear-gradient(to bottom right, #fbbf24, #f59e0b)'
        }}
        initial={{ x: theme === 'dark' ? -10 : 10 }}
        animate={{ x: theme === 'dark' ? -10 : 10 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 22,
          mass: 0.8
        }}
      >
        {theme === 'dark' ? (
          <span className="w-2 h-2 bg-white rounded-full opacity-80" />
        ) : (
          <span className="w-3 h-3 bg-white rounded-full opacity-90 transform scale-75" />
        )}
      </motion.div>
    </motion.button>
  );
}; 