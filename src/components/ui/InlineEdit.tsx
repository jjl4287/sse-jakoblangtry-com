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
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    } else if (e.key === ' ') {
      e.stopPropagation();
    }
  };

  // Separate user-provided props to avoid override
  const {
    onKeyDown: userOnKeyDown,
    className: userClassName,
    ...restInputProps
  } = inputProps ?? {};

  // Use box-shadow for underline (inset) so it doesn't affect layout height
  const commonBehaviorClasses = 'transition-shadow duration-200 ease-in-out';
  const inputSpecificClasses = 'focus:shadow-[inset_0_-2px_0_0_currentColor] focus:outline-none';
  const displaySpecificClasses = 'hover:shadow-[inset_0_-2px_0_0_currentColor] cursor-text';

  if (isEditing) {
    return (
      <input
        // Spread other props first so event handlers below are not overridden
        {...restInputProps}
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          handleKeyDown(e);
          userOnKeyDown?.(e);
        }}
        placeholder={placeholder}
        className={cn(className, userClassName, commonBehaviorClasses, inputSpecificClasses)}
      />
    );
  }

  return (
    <span
      onDoubleClick={onEditStart}
      className={cn(className, commonBehaviorClasses, displaySpecificClasses)}
    >
      {value || placeholder}
    </span>
  );
});

InlineEdit.displayName = 'InlineEdit';