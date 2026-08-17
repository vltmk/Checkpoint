import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export const Button = React.forwardRef(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      disabled = false,
      children,
      type = 'button',
      onClick,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium tracking-tight rounded-lg transition-all duration-150 select-none disabled:opacity-40 disabled:pointer-events-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30';

    const variants = {
      default:
        'bg-white/[0.05] hover:bg-white/[0.09] active:bg-white/[0.04] text-zinc-200 hover:text-white border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]',
      primary:
        'bg-white hover:bg-zinc-200 active:bg-zinc-300 text-black font-semibold shadow-[0_0_20px_rgba(255,255,255,0.15)] border border-transparent',
      ghost:
        'bg-transparent hover:bg-white/[0.06] active:bg-white/[0.03] text-zinc-400 hover:text-zinc-100 border border-transparent',
      danger:
        'bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/15 text-rose-400 hover:text-rose-300 border border-rose-500/20',
      outline:
        'bg-transparent hover:bg-white/[0.04] text-zinc-300 hover:text-white border border-white/[0.12]',
      secondary:
        'bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800',
    };

    const sizes = {
      xs: 'text-[11px] h-7 px-2.5 gap-1.5',
      sm: 'text-xs h-8 px-3 gap-1.5',
      md: 'text-xs h-9 px-3.5 gap-2',
      lg: 'text-sm h-10 px-4 gap-2.5',
      icon: 'h-8 w-8 p-0',
      'icon-sm': 'h-7 w-7 p-0',
      'icon-xs': 'h-6 w-6 p-0',
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        whileHover={disabled ? undefined : { scale: 1.01 }}
        disabled={disabled}
        onClick={onClick}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
