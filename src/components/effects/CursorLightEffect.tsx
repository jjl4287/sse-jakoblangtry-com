'use client';

import React, { useState, useEffect } from 'react';

const CursorLightEffect: React.FC = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setPosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Style will be applied via CSS class, updated by position
  const lightStyle: React.CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    // We use translate to center the gradient on the cursor
    transform: 'translate(-50%, -50%)',
  };

  return <div className="cursor-light" style={lightStyle} />;
};

export default CursorLightEffect; 