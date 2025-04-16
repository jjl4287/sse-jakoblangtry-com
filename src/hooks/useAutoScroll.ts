'use client';

import { useRef, useCallback, useEffect } from 'react';
import type { DropTargetMonitor } from 'react-dnd';
import type { CardDragItem } from '~/constants/dnd-types'; // Assuming this type is needed or adjust as necessary

// Configuration constants (could be passed as options)
const SCROLL_AREA_HEIGHT = 60;
const SCROLL_SPEED = 10;

/**
 * Custom hook to handle auto-scrolling of a container when a 
 * react-dnd item is dragged near its top or bottom edges.
 * 
 * @param scrollRef RefObject to the scrollable HTML element.
 * @param isDragging Boolean indicating if a drag operation is currently active.
 */
export function useAutoScroll(
  scrollRef: React.RefObject<HTMLElement | null>,
  isDragging: boolean
) {
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to start the scrolling interval
  const startAutoScroll = useCallback((direction: number) => {
    if (scrollIntervalRef.current || !scrollRef.current) return; // Already scrolling or no element
    const element = scrollRef.current;
    scrollIntervalRef.current = setInterval(() => {
      element.scrollTop += direction * SCROLL_SPEED;
    }, 16); // ~60 FPS
  }, [scrollRef]);

  // Function to stop the scrolling interval
  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  // Main function to handle hover events and trigger scroll
  const handleHoverForScroll = useCallback(
    (monitor: DropTargetMonitor<CardDragItem, unknown>) => {
      const scrollElement = scrollRef.current;
      if (!scrollElement || !monitor.isOver({ shallow: true })) {
        stopAutoScroll();
        return;
      }

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        stopAutoScroll();
        return;
      }

      const elementRect = scrollElement.getBoundingClientRect();
      const hoverY = clientOffset.y - elementRect.top;

      let scrollDirection = 0;
      if (hoverY < SCROLL_AREA_HEIGHT) {
        scrollDirection = -1; // Scroll up
      } else if (elementRect.height - hoverY < SCROLL_AREA_HEIGHT) {
        scrollDirection = 1; // Scroll down
      }

      if (scrollDirection !== 0) {
        startAutoScroll(scrollDirection);
      } else {
        stopAutoScroll();
      }
    },
    [scrollRef, startAutoScroll, stopAutoScroll]
  );

  // Cleanup scroll interval on unmount
  useEffect(() => {
    return () => stopAutoScroll();
  }, [stopAutoScroll]);

  // Stop scroll when the global drag ends
  useEffect(() => {
    if (!isDragging) {
      stopAutoScroll();
    }
  }, [isDragging, stopAutoScroll]);

  // Return the handler function to be used in useDrop's hover
  return { handleHoverForScroll, stopAutoScroll };
} 