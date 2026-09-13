import React from 'react';
import { cn } from '../../lib/utils';

export function Switch({
  checked = false,
  onChange,
  onCheckedChange,
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel,
  ...props
}) {
  const triggerChange = (newVal) => {
    onChange?.(newVal);
    onCheckedChange?.(newVal);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    triggerChange(!checked);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      triggerChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      dir="ltr"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative inline-flex h-5 w-9 p-0.5 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 select-none',
        checked
          ? 'bg-zinc-900 dark:bg-zinc-100'
          : 'bg-zinc-300 dark:bg-zinc-700',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out',
          checked
            ? 'translate-x-4 bg-white dark:bg-zinc-950'
            : 'translate-x-0 bg-white dark:bg-zinc-300'
        )}
      />
    </button>
  );
}

export default Switch;
