import React, { useEffect, useRef, forwardRef } from 'react';
import { cn } from '~/lib/utils';

export interface InlineEditProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel?: () => void;
  placeholder?: string;
  isEditing: boolean;
  onEditStart?: () => void;
  /** Additional classes for input and display states */
  className?: string;
  /** Props to spread onto the <input> */
  inputProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'ref'>;
}

export const InlineEdit = forwardRef<HTMLInputElement, InlineEditProps>((
  {
    value,
    onChange,
    onSave,
    onCancel,
    placeholder,
    isEditing,
    onEditStart,
    className,
    inputProps,
  },
  ref
) => {
  useEffect(() => {
    if (isEditing && ref && typeof ref !== 'function' && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [isEditing, ref]);

  const handleBlur = () => {
    onSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    } else if (e.key === ' ') {
      e.stopPropagation();
    }
  };

  const commonBehaviorClasses = 'border-b-2 border-transparent transition-colors duration-200 ease-in-out';
  const inputSpecificClasses = 'focus:border-foreground focus:outline-none';
  const displaySpecificClasses = 'hover:border-foreground cursor-text';

  if (isEditing) {
    return (
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          handleKeyDown(e);
          inputProps?.onKeyDown?.(e);
        }}
        placeholder={placeholder}
        className={cn(commonBehaviorClasses, inputSpecificClasses, className, inputProps?.className)}
        {...inputProps}
      />
    );
  }

  return (
    <span
      onDoubleClick={onEditStart}
      className={cn(commonBehaviorClasses, displaySpecificClasses, className)}
    >
      {value || placeholder}
    </span>
  );
});

InlineEdit.displayName = 'InlineEdit';