import React from 'react';
import { cn } from '../../lib/utils';

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium leading-none transition-[color,background-color,border-color,opacity,transform] duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97] select-none';

  const variants = {
    primary:
      'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-100 border border-transparent shadow-sm',
    secondary:
      'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100 dark:border-zinc-800',
    outline:
      'bg-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 border-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:border-zinc-800',
    ghost:
      'bg-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-900 border border-transparent',
    danger:
      'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 dark:border-rose-800/40',
  };

  const sizes = {
    xs: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
    sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
    md: 'h-9 px-3.5 text-xs rounded-md gap-2',
    lg: 'h-10 px-4 text-sm rounded-lg gap-2',
    icon: 'h-8 w-8 p-0 rounded-md',
    'icon-sm': 'h-7 w-7 p-0 rounded-md',
  };

  const variantClass = variants[variant] || variants.secondary;
  const sizeClass = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(baseStyles, variantClass, sizeClass, className)}
      {...props}
    >
      {typeof children === 'string' ? <span>{children}</span> : children}
    </button>
  );
}

export default Button;
