import React from 'react';

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
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] select-none';

  const variants = {
    primary:
      'bg-zinc-100 text-zinc-950 hover:bg-white border border-transparent shadow-sm',
    secondary:
      'bg-zinc-900 text-zinc-200 hover:bg-zinc-800/80 hover:text-white border border-zinc-800',
    outline:
      'bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white border border-zinc-800',
    ghost:
      'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent',
    danger:
      'bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/40',
  };

  const sizes = {
    xs: 'h-7 px-2 text-xs rounded-lg gap-1.5',
    sm: 'h-8 px-2.5 text-xs rounded-lg gap-1.5',
    md: 'h-9 px-3.5 text-xs rounded-lg gap-2',
    lg: 'h-10 px-4 text-sm rounded-xl gap-2',
    icon: 'h-8 w-8 p-0 rounded-lg',
    'icon-sm': 'h-7 w-7 p-0 rounded-lg',
  };

  const variantClass = variants[variant] || variants.secondary;
  const sizeClass = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
