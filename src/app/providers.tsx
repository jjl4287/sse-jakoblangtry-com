'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '~/contexts/ThemeContext';
import { Toaster } from '~/components/ui/sonner';

interface ProvidersProps {
  children: React.ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <Toaster richColors position="bottom-right" closeButton />
      </ThemeProvider>
    </SessionProvider>
  );
} 