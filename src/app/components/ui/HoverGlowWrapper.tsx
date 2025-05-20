import React, { ReactNode, useRef } from 'react';
import { useMousePositionStyle } from '@/hooks/useMousePositionStyle';
import './HoverGlowWrapper.css';

interface HoverGlowWrapperProps {
  className?: string;
  children: ReactNode;
}

export default function HoverGlowWrapper({ className = '', children }: HoverGlowWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  useMousePositionStyle(ref);
  return (
    <div ref={ref} className={`hover-glow-wrapper ${className}`}>  {/* Wrapper for hover glow effect */}
      {children}
    </div>
  );
} 