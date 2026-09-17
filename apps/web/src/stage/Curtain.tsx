import type { GameState } from '@babel-game/game-core';
import type { Spotlight } from '@babel-game/stagecraft';
import { Button } from '@/components/ui/button';
import { describe } from '../Panels';

/**
 * What the action bar says while the screen is catching up.
 *
 * The words are `describe`'s — the same sentence this moment will have in the
 * log, rather than a second set of wording that can drift from it. The bar is
 * the right place for them: it is where a player is already looking for what
 * to do next, and it means no control is on screen that belongs to a moment
 * that has already gone.
 */
export function Curtain({
  spot,
  state,
  onSkip,
}: {
  spot: Spotlight | null;
  state: GameState;
  onSkip: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">{spot ? describe(spot.cause, state) : '…'}</span>
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto shrink-0"
        onClick={onSkip}
        aria-label="Skip to the end of this sequence"
      >
        Skip
      </Button>
    </div>
  );
}
