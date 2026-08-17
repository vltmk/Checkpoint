import React from 'react';
import wowIcon from '../../../world-of-warcraft-retail.svg';
import { Gamepad2 } from 'lucide-react';

export function GameIcon({ game, className = 'w-4 h-4' }) {
  const isWoW =
    game === 'World of Warcraft' ||
    game === 'World of Warcraft Classic' ||
    (typeof game === 'string' && game.toLowerCase().includes('warcraft'));

  if (isWoW) {
    return (
      <img
        src={wowIcon}
        alt="World of Warcraft"
        className={`inline-block object-contain shrink-0 ${className}`}
      />
    );
  }

  return <Gamepad2 className={`text-zinc-500 shrink-0 ${className}`} />;
}

export default GameIcon;
