'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Custom hook to track mouse position relative to a referenced element 
 * and update CSS variables (--x, --y) for lighting effects.
 */
export function useMousePositionStyle(ref: RefObject<HTMLElement | null>) { // Allow null ref
  // No state needed here, we directly manipulate the element's style

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      element.style.setProperty('--mouse-x', `${x}px`);
      element.style.setProperty('--mouse-y', `${y}px`);
    };
    element.addEventListener('mousemove', handleMouseMove);
    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
    };
  }, [ref]); // Dependency array includes the ref

  // This hook doesn't need to return anything as it works via side effects
}