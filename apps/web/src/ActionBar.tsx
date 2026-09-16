import type { ReactNode } from 'react';
import { RESOURCE_TYPES, SCHEMES, type ResourceType } from '@babel-game/game-data';
import type { GameState, LegalAction } from '@babel-game/game-core';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RESOURCE_LABEL } from './theme';

/** A button that explains itself on hover rather than in permanent copy. */
export function Act({
  label,
  hint,
  disabled,
  onClick,
  variant = 'outline',
}: {
  label: ReactNode;
  hint: string;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'outline' | 'default' | 'accent' | 'secondary' | 'ghost';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button swallows pointer events, so the tooltip needs a
            wrapper to hang off — otherwise the explanation you most want is
            exactly the one you cannot read. */}
        <span className="inline-flex">
          <Button size="sm" variant={variant} disabled={disabled} onClick={onClick}>
            {label}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

export function cost(entries: Partial<Record<ResourceType, number>>): string {
  return Object.entries(entries)
    .map(([r, n]) => `${n} ${RESOURCE_LABEL[r as ResourceType]}`)
    .join(' + ');
}

/** The seven actions of GDD §11, each explaining its own rule on hover. */
export function ActionButtons({
  state,
  legal,
  onBuild,
  onTower,
  onWalls,
  onBabel,
  onAttack,
  onMuster,
  onScheme,
  onBarter,
  onPass,
}: {
  state: GameState;
  legal: readonly LegalAction[];
  onBuild: () => void;
  onTower: () => void;
  onWalls: () => void;
  onBabel: () => void;
  onAttack: () => void;
  onMuster: () => void;
  onScheme: () => void;
  onBarter: () => void;
  onPass: () => void;
}) {
  const find = <T extends LegalAction['type']>(type: T) =>
    legal.find((a) => a.type === type) as Extract<LegalAction, { type: T }> | undefined;

  const build = find('buildHarvester');
  const tower = find('buildTower');
  const walls = find('buildWalls');
  const babel = find('buildBabel');
  const attack = find('attack');
  const muster = find('muster');
  const scheme = find('buyScheme');
  const barter = legal.some((a) => a.type === 'barter');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Act
        label="Build"
        disabled={!build}
        onClick={onBuild}
        hint={
          build
            ? `A harvesting building on matching terrain. It pays you whenever another Leader expands its feature. ${build.sites.length} sites open.`
            : 'No legal site, or you cannot afford one.'
        }
      />
      <Act
        label="Tower"
        disabled={!tower}
        onClick={onTower}
        hint={
          tower
            ? 'Costs 2 Wood + 1 Metal. One per feature. Adds a support die whenever any Leader Attacks into it — but only while it is occupied.'
            : 'Cannot afford it, or every feature is already defended.'
        }
      />
      <Act
        label="Walls"
        disabled={!walls}
        onClick={onWalls}
        hint={
          walls
            ? `1 Wood for ${walls.segments} segment${walls.segments === 1 ? '' : 's'}. A Host crossing one destroys it and spends its whole movement doing so.`
            : 'Cannot afford it, or nowhere to build.'
        }
      />
      <Act
        label="Babel"
        variant={babel ? 'accent' : 'outline'}
        disabled={!babel}
        onClick={onBabel}
        hint={
          babel
            ? `Costs ${cost(babel.cost)}. Worth ${state.stage + 1} Prestige. Finishing a Stage escalates Heaven permanently.`
            : 'Cannot afford a piece, the Foundation is occupied, or Confusion forbids it.'
        }
      />
      <Act
        label="Attack"
        variant={attack ? 'default' : 'outline'}
        disabled={!attack}
        onClick={onAttack}
        hint={
          attack
            ? `Roll ${attack.dice} d6 + 2 against Defence ${attack.defence}, then assign the hits. +1 Prestige per kill.${
                attack.cost ? ` Costs ${attack.cost.amount} ${attack.cost.resource}.` : ''
              }`
            : 'No Hosts on the board, Confusion forbids it, or you cannot pay for a single die.'
        }
      />
      <Act
        label="Muster"
        disabled={!muster}
        onClick={onMuster}
        hint={
          muster
            ? `1 Food + 1 Metal for a ${muster.army}th Army die. Five is the maximum.`
            : 'Cannot afford it, or already at five dice.'
        }
      />
      <Act
        label="Scheme"
        disabled={!scheme}
        onClick={onScheme}
        hint={
          scheme
            ? '1 Food + 1 Metal for a blind Scheme. Powerful, rule-breaking, and hidden from everyone else.'
            : 'Cannot afford it, none left, or you are on a bonus action.'
        }
      />
      <Act
        label="Barter"
        disabled={!barter}
        onClick={onBarter}
        hint={
          barter
            ? 'Discard any 3 cards for 1 of your choice. Deliberately inefficient — bad luck protection, not an economy.'
            : 'You need three resource cards.'
        }
      />
      <Act
        label="Pass"
        variant="ghost"
        onClick={onPass}
        hint="Take no action. Always available, even under Fractured Command."
      />
    </div>
  );
}

export { RESOURCE_TYPES, SCHEMES };
