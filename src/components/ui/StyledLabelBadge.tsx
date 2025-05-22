import React from 'react';
import { Badge } from '~/components/ui/badge';
import { XIcon as CloseIconLucide } from 'lucide-react';
import { getContrastingTextColor } from '~/lib/utils';
import type { Label as LabelType } from '~/types';

interface StyledLabelBadgeProps {
  label: LabelType;
  onRemove?: (labelId: string) => void;
  // Add any other props you might need, e.g., for different sizes or interactivity
}

export const StyledLabelBadge: React.FC<StyledLabelBadgeProps> = ({ label, onRemove }) => {
  return (
    <Badge
      key={label.id}
      className="px-2 py-1 text-xs font-normal rounded-full border items-center"
      style={{
        backgroundColor: label.color,
        color: getContrastingTextColor(label.color),
        borderColor: getContrastingTextColor(label.color) === '#000000' ? '#00000030' : '#FFFFFF50',
      }}
    >
      <span>{label.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click or other parent actions
            onRemove(label.id);
          }}
          className="ml-1 -mr-1 p-1 rounded-full inline-flex items-center justify-center opacity-75 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-offset-1"
          style={{ 
            color: getContrastingTextColor(label.color),
            // Basic focus ring color, can be improved
            // @ts-expect-error CSS custom property
            '--tw-ring-color': getContrastingTextColor(label.color) === '#000000' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
           }}
          aria-label={`Remove label ${label.name}`}
        >
          <CloseIconLucide className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}; 