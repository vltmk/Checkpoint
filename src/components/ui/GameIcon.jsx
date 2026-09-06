import React from 'react';
import wowIcon from '../../assets/world-of-warcraft-retail.svg';
import { Gamepad2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export function GameIcon({ game, customIcon = null, categories = null, className = 'w-4 h-4' }) {
  // If customIcon is directly provided
  let iconSrc = customIcon;

  // Otherwise, if categories array is available, look up by game name
  if (!iconSrc && Array.isArray(categories) && game) {
    const clean = typeof game === 'string' ? game.trim().toLowerCase() : '';
    const match = categories.find((c) => c.name?.trim().toLowerCase() === clean);
    if (match?.icon) {
      iconSrc = match.icon;
    }
  }

  if (iconSrc) {
    return (
      <img
        src={iconSrc}
        alt={typeof game === 'string' ? game : 'Game Icon'}
        className={cn('inline-block rounded-[22.5%] object-cover shrink-0 shadow-2xs', className)}
      />
    );
  }

  const isWoW =
    game === 'World of Warcraft' ||
    game === 'World of Warcraft Classic' ||
    (typeof game === 'string' && game.toLowerCase().includes('warcraft'));

  if (isWoW) {
    return (
      <img
        src={wowIcon}
        alt="World of Warcraft"
        className={cn('inline-block object-contain shrink-0', className)}
      />
    );
  }

  return <Gamepad2 className={cn('text-zinc-500 shrink-0', className)} />;
}

export default GameIcon;

