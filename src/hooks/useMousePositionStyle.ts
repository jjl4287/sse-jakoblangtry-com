'use client';

import { useState, useEffect, RefObject } from 'react';

/**
 * Custom hook to track mouse position relative to a referenced element 
 * and update CSS variables (--x, --y) for lighting effects.
 */
export function useMousePositionStyle(ref: RefObject<HTMLElement | null>) { // Allow null ref
  // No state needed here, we directly manipulate the element's style

  useEffect(() => {
    const element = ref.current;
    // ... (rest of hook is the same)
  }, [ref]); // Dependency array includes the ref

  // This hook doesn't need to return anything as it works via side effects
}