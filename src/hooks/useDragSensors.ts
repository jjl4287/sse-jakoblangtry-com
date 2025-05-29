import { useMemo } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { MouseEvent, KeyboardEvent } from 'react';

// Custom PointerSensor that respects the card details sheet state
class CustomPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: MouseEvent) => {
        // Check if card details sheet is open
        if (document.documentElement.classList.contains('card-details-sheet-open')) {
          return false;
        }
        
        // Also check for data-no-dnd attribute
        let target = event.target as HTMLElement;
        while (target) {
          if (target.dataset && target.dataset.noDnd) {
            return false;
          }
          target = target.parentElement as HTMLElement;
        }
        
        return event.isPrimary && event.button === 0;
      },
    },
  ];
}

// Custom KeyboardSensor that respects the card details sheet state
class CustomKeyboardSensor extends KeyboardSensor {
  static activators = [
    {
      eventName: 'onKeyDown' as const,
      handler: ({ nativeEvent: event }: KeyboardEvent<Element>) => {
        // Check if card details sheet is open
        if (document.documentElement.classList.contains('card-details-sheet-open')) {
          return false;
        }
        
        // Also check for data-no-dnd attribute
        let target = event.target as HTMLElement;
        while (target) {
          if (target.dataset && target.dataset.noDnd) {
            return false;
          }
          target = target.parentElement as HTMLElement;
        }
        
        return true;
      },
    },
  ];
}

export const useDragSensors = () => {
  const sensors = useSensors(
    useSensor(CustomPointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(CustomKeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return sensors;
}; 