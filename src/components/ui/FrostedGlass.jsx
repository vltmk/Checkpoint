import React, { forwardRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/utils';

/**
 * Apple-Grade Frosted Glass Surface
 *
 * Implements Apple Human Interface Guidelines for materials and depth:
 * - High optical diffusion: 24-30px backdrop blur + 180% saturation boost
 * - Semantic material variants: menu, popover (small floating surfaces only; dialogs and drawers are solid)
 * - Directional specular sheen: Top-edge light catching highlight (inset 0 1px 0 0 ...)
 * - Anti-banding micro-dither: Embedded inline SVG dither to eliminate dark gradient stepping
 * - GPU hardware acceleration: translateZ(0) & compositor isolation
 * - Dual-theme support: Dark zinc and paper-white light mode
 * - Full accessibility: Respects prefers-reduced-transparency & prefers-reduced-motion
 */
export const FrostedGlass = forwardRef(function FrostedGlass(
  {
    as = 'div',
    variant = 'popover',
    dither = true,
    specular = true,
    className,
    children,
    style,
    // Motion props (when as='motion' or as='motion.div')
    initial,
    animate,
    exit,
    transition,
    ...props
  },
  ref
) {
  const shouldReduceMotion = useReducedMotion();

  const variantClasses = {
    menu: 'checkpoint-frosted-menu border border-zinc-200/90 dark:border-zinc-800/80 rounded-xl',
    popover: 'checkpoint-frosted-popover border border-zinc-200/90 dark:border-zinc-800/80 rounded-lg',
  };

  const combinedClassName = cn(
    'checkpoint-frosted-base relative',
    variantClasses[variant] || variantClasses.popover,
    className
  );

  const defaultMotionTransition = shouldReduceMotion
    ? { duration: 0.15 }
    : { type: 'spring', bounce: 0, duration: 0.24 };

  // Render motion.div if explicitly requested
  if (as === 'motion' || as === 'motion.div') {
    return (
      <motion.div
        ref={ref}
        initial={initial}
        animate={animate}
        exit={exit}
        transition={transition || defaultMotionTransition}
        className={combinedClassName}
        style={style}
        {...props}
      >
        {dither && <div className="checkpoint-glass-dither" aria-hidden="true" />}
        {children}
      </motion.div>
    );
  }

  // Standard polymorphic HTML elements
  const Component = as;
  return (
    <Component
      ref={ref}
      className={combinedClassName}
      style={style}
      {...props}
    >
      {dither && <div className="checkpoint-glass-dither" aria-hidden="true" />}
      {children}
    </Component>
  );
});

export default FrostedGlass;
