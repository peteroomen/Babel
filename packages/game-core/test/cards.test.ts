import { describe, expect, it } from 'vitest';
import { CONFUSION_IDS, confusionCardsForStage } from '@babel-game/game-data';
import {
  activeConfusion,
  applyMove,
  drawCard,
  createRng,
  getLegalActions,
  isActionBlockedByConfusion,
  resolveHeavenPhase,
  setupGame,
  type Board,
  type ConfusionId,
  type GameState,
  type Host,
} from '../src/index.js';

const land = (terrain: Board[string]['terrain'] = 'desert') =>
  ({ terrain, river: 'none', rotation: 0 }) as const;

const ophanim = (id: string, x: number, y: number): Host => ({
  id,
  kind: 'ophanim',
  at: { x, y },
  shieldUp: false,
});

/** A Leader ready to act, under a chosen Confusion card. */
function under(card: ConfusionId | null, over: Partial<GameState> = {}): GameState {
  const base = setupGame(['Ada', 'Peter'], 'cards');
  return {
    ...base,
    board: { '1,0': land('forest'), '2,0': land('forest') },
    confusion: { card, cancelledBy: null },
    turnStep: 'action',
    currentPlayerIndex: 0,
    firstPlayerIndex: 0,
    drawnTile: null,
    leaders: Object.fromEntries(
      Object.entries(base.leaders).map(([id, l]) => [
        id,
        { ...l, resources: { food: 9, wood: 9, brick: 9, metal: 9 }, army: 2 },
      ]),
    ),
    ...over,
  };
}

describe('Confusion deck (GDD §19)', () => {
  it('starts at six cards and grows to nine', () => {
    expect(confusionCardsForStage(1)).toHaveLength(6);
    expect(confusionCardsForStage(2)).toHaveLength(2);
    expect(confusionCardsForStage(3)).toHaveLength(1);
    const total = [1, 2, 3].reduce(
      (sum, s) => sum + confusionCardsForStage(s as 1 | 2 | 3).length,
      0,
    );
    expect(total).toBe(9);
  });

  it('holds exactly six unique effects', () => {
    expect(new Set(CONFUSION_IDS).size).toBe(6);
  });

  it('deals a card at setup and keeps the rest', () => {
    const state = setupGame(['Ada', 'Peter'], 'cards');
    expect(state.confusion.card).not.toBeNull();
    expect(state.confusionDeck).toHaveLength(5);
  });

  it('reshuffles the discard when the draw pile runs out', () => {
    const result = drawCard<ConfusionId>([], ['lost-ledgers', 'silent-workshops'], createRng('x'));
    expect(result.card).not.toBeNull();
    expect(result.deck).toHaveLength(1);
    expect(result.discard).toHaveLength(0);
  });

  it('reports nothing to draw from two empty piles', () => {
    expect(drawCard<ConfusionId>([], [], createRng('x')).card).toBeNull();
  });

  it('treats a cancelled card as no Confusion at all', () => {
    const state = under('stalled-works', { confusion: { card: 'stalled-works', cancelledBy: 'p1' } });
    expect(activeConfusion(state)).toBeNull();
    expect(isActionBlockedByConfusion(state, 'p0', 'babel')).toBe(false);
  });
});

describe('Silent Workshops (GDD §19)', () => {
  it('stops harvesting buildings triggering', () => {
    const state = under('silent-workshops', {
      buildings: { '1,0': { type: 'sawmill', owner: 'p1' } },
      turnStep: 'place',
      drawnTile: { terrain: 'forest', river: 'none' },
    });
    const before = state.leaders['p1']!.resources.wood;
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: 'p0',
      at: { x: 3, y: 0 },
      rotation: 0,
    });

    expect(after.leaders['p1']!.resources.wood).toBe(before);
    expect(events.some((e) => e.type === 'harvestTriggered')).toBe(false);
    /* The placer still takes their own base payout. */
    expect(events.some((e) => e.type === 'resourcesGained' && e.player === 'p0')).toBe(true);
  });
});

describe('Lost Ledgers (GDD §19)', () => {
  it('denies the placer their base payout', () => {
    const state = under('lost-ledgers', {
      turnStep: 'place',
      drawnTile: { terrain: 'forest', river: 'none' },
    });
    const before = state.leaders['p0']!.resources.wood;
    const { state: after, events } = applyMove(state, {
      type: 'placeTile',
      player: 'p0',
      at: { x: 3, y: 0 },
      rotation: 0,
    });

    expect(after.leaders['p0']!.resources.wood).toBe(before);
    expect(events).toContainEqual({
      type: 'payoutSuppressed',
      player: 'p0',
      at: { x: 3, y: 0 },
      reason: 'lostLedgers',
    });
  });

  it('still resolves foreign harvesting buildings, and the placer keeps the +1 (RD-012)', () => {
    const state = under('lost-ledgers', {
      buildings: { '1,0': { type: 'sawmill', owner: 'p1' } },
      turnStep: 'place',
      drawnTile: { terrain: 'forest', river: 'none' },
    });
    const before = {
      placer: state.leaders['p0']!.resources.wood,
      owner: state.leaders['p1']!.resources.wood,
    };
    const after = applyMove(state, {
      type: 'placeTile',
      player: 'p0',
      at: { x: 3, y: 0 },
      rotation: 0,
    }).state;

    /* The Sawmill's owner is paid in full... */
    expect(after.leaders['p1']!.resources.wood).toBeGreaterThan(before.owner);
    /* ...and the placer gets only the +1 infrastructure bonus. */
    expect(after.leaders['p0']!.resources.wood).toBe(before.placer + 1);
  });
});

describe('Fractured Command (GDD §19)', () => {
  it('lets only one Leader use each action category', () => {
    let state = under('fractured-command');
    state = applyMove(state, { type: 'barter', player: 'p0', spend: ['wood', 'wood', 'food'], gain: 'brick' }).state;

    /* p1's turn; Barter is spoken for. */
    const next: GameState = { ...state, turnStep: 'action', drawnTile: null };
    expect(() =>
      applyMove(next, { type: 'barter', player: 'p1', spend: ['wood', 'wood', 'food'], gain: 'brick' }),
    ).toThrow(/Confusion forbids/);
    expect(getLegalActions(next, 'p1').map((a) => a.type)).not.toContain('barter');
  });

  it('still lets the same Leader repeat their own category', () => {
    const state = under('fractured-command', { actionsThisRound: { barter: 'p0' } });
    expect(isActionBlockedByConfusion(state, 'p0', 'barter')).toBe(false);
    expect(isActionBlockedByConfusion(state, 'p1', 'barter')).toBe(true);
  });

  it('never blocks Pass, so a round cannot deadlock (RD-013)', () => {
    const state = under('fractured-command', {
      actionsThisRound: {
        build: 'p1',
        babel: 'p1',
        attack: 'p1',
        muster: 'p1',
        scheme: 'p1',
        barter: 'p1',
        pass: 'p1',
      },
    });
    expect(isActionBlockedByConfusion(state, 'p0', 'pass')).toBe(false);
    expect(getLegalActions(state, 'p0').map((a) => a.type)).toEqual(['pass']);
  });

  it('resets between rounds', () => {
    const state = under('fractured-command', { actionsThisRound: { barter: 'p0' } });
    const nextRound = applyMove(
      { ...state, phase: 'heaven', turnStep: 'action', drawnTile: null },
      { type: 'resolveHeaven', player: 'p0' },
    ).state;
    expect(nextRound.actionsThisRound).toEqual({});
  });
});

describe('Stalled Works and Broken Swords (GDD §19)', () => {
  it('Stalled Works forbids the Babel action', () => {
    const state = under('stalled-works');
    expect(() => applyMove(state, { type: 'buildBabel', player: 'p0' })).toThrow(
      /Confusion forbids/,
    );
    expect(getLegalActions(state, 'p0').map((a) => a.type)).not.toContain('buildBabel');
  });

  it('Broken Swords forbids the Attack action', () => {
    const state = under('broken-swords', { hosts: [ophanim('h1', 1, 0)] });
    expect(() => applyMove(state, { type: 'attack', player: 'p0' })).toThrow(
      /Confusion forbids/,
    );
    expect(getLegalActions(state, 'p0').map((a) => a.type)).not.toContain('attack');
  });
});

describe('March of Heaven (GDD §19)', () => {
  it('gives every Host one extra tile of movement', () => {
    const corridor: Board = { '1,0': land(), '2,0': land(), '3,0': land() };
    const marching = under('march-of-heaven', {
      board: corridor,
      hosts: [ophanim('h1', 3, 0)],
    });
    const calm = under(null, { board: corridor, hosts: [ophanim('h1', 3, 0)] });

    /* Movement 1 normally, so 2,0; Movement 2 under the card, so 1,0. */
    expect(resolveHeavenPhase(calm).state.hosts[0]!.at).toEqual({ x: 2, y: 0 });
    expect(resolveHeavenPhase(marching).state.hosts[0]!.at).toEqual({ x: 1, y: 0 });
  });
});

describe('Schemes (GDD §18)', () => {
  it('buys blind for 1 Food + 1 Metal', () => {
    const state = under(null);
    const { state: after, events } = applyMove(state, { type: 'buyScheme', player: 'p0' });

    expect(after.leaders['p0']!.schemeHand).toHaveLength(1);
    expect(after.leaders['p0']!.resources.food).toBe(8);
    expect(after.leaders['p0']!.resources.metal).toBe(8);
    expect(after.schemeDeck).toHaveLength(5);
    expect(events).toContainEqual({ type: 'schemeBought', player: 'p0' });
  });

  it('refuses to play a Scheme the Leader does not hold', () => {
    const state = under(null);
    expect(() =>
      applyMove(state, { type: 'playScheme', player: 'p0', scheme: 'common-tongue' }),
    ).toThrow(/do not hold/);
  });

  it('Common Tongue cancels the revealed Confusion', () => {
    const base = under('stalled-works', { phase: 'confusion' });
    const state: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, schemeHand: ['common-tongue'] },
      },
    };
    const { state: after, events } = applyMove(state, {
      type: 'playScheme',
      player: 'p0',
      scheme: 'common-tongue',
    });

    expect(after.confusion.cancelledBy).toBe('p0');
    expect(activeConfusion(after)).toBeNull();
    expect(after.phase).toBe('turns');
    expect(after.leaders['p0']!.schemeHand).toEqual([]);
    expect(after.schemeDiscard).toContain('common-tongue');
    expect(events.some((e) => e.type === 'confusionCancelled')).toBe(true);
  });

  it('Frenzied Works grants a second action, which cannot buy a Scheme', () => {
    const base = under(null);
    const state: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, schemeHand: ['frenzied-works'] },
      },
    };

    /* The first action opens the window instead of ending the turn. */
    const acted = applyMove(state, { type: 'pass', player: 'p0' }).state;
    expect(acted.bonusWindow).toBe('p0');
    expect(acted.currentPlayerIndex).toBe(0);

    const bonus = applyMove(acted, {
      type: 'playScheme',
      player: 'p0',
      scheme: 'frenzied-works',
    }).state;
    expect(bonus.inBonusAction).toBe(true);
    expect(bonus.turnStep).toBe('action');
    expect(() => applyMove(bonus, { type: 'buyScheme', player: 'p0' })).toThrow(
      /bonus action cannot buy a Scheme/,
    );

    /* The second action ends the turn for real. */
    const done = applyMove(bonus, { type: 'pass', player: 'p0' }).state;
    expect(done.currentPlayerIndex).toBe(1);
    expect(done.inBonusAction).toBe(false);
  });

  it('lets a Leader decline the Frenzied Works window', () => {
    const base = under(null);
    const state: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, schemeHand: ['frenzied-works'] },
      },
    };
    const acted = applyMove(state, { type: 'pass', player: 'p0' }).state;
    const declined = applyMove(acted, { type: 'endTurn', player: 'p0' }).state;

    expect(declined.currentPlayerIndex).toBe(1);
    /* Declining does not spend the card. */
    expect(declined.leaders['p0']!.schemeHand).toEqual(['frenzied-works']);
  });

  it('False Prophet sends a Host sideways and ends its movement', () => {
    const board: Board = { '1,0': land(), '2,0': land(), '2,1': land() };
    const base = under(null, {
      board,
      hosts: [ophanim('h1', 2, 0)],
      phase: 'heaven',
      turnStep: 'action',
      drawnTile: null,
    });
    const state: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, schemeHand: ['false-prophet'] },
      },
    };

    /* 2,1 is adjacent but further from Babel than 1,0. */
    const redirected = applyMove(state, {
      type: 'playScheme',
      player: 'p0',
      scheme: 'false-prophet',
      hostId: 'h1',
      to: { x: 2, y: 1 },
    }).state;
    expect(redirected.falseProphet).toEqual({ hostId: 'h1', to: { x: 2, y: 1 } });

    const after = resolveHeavenPhase(redirected).state;
    expect(after.hosts.find((h) => h.id === 'h1')!.at).toEqual({ x: 2, y: 1 });
  });

  it('refuses a False Prophet destination that is not adjacent', () => {
    const base = under(null, {
      board: { '1,0': land(), '2,0': land() },
      hosts: [ophanim('h1', 2, 0)],
      phase: 'heaven',
    });
    const state: GameState = {
      ...base,
      leaders: {
        ...base.leaders,
        p0: { ...base.leaders['p0']!, schemeHand: ['false-prophet'] },
      },
    };
    expect(() =>
      applyMove(state, {
        type: 'playScheme',
        player: 'p0',
        scheme: 'false-prophet',
        hostId: 'h1',
        to: { x: 9, y: 9 },
      }),
    ).toThrow(/not an adjacent legal tile/);
  });
});

describe('hidden Scheme hands (GDD §18)', () => {
  it('keeps a bought Scheme out of another Leader’s view', async () => {
    const { playerView } = await import('../src/index.js');
    const state = applyMove(under(null), { type: 'buyScheme', player: 'p0' }).state;

    expect(playerView(state, 'p0').leaders['p0']!.schemeHand).toHaveLength(1);
    expect(playerView(state, 'p1').leaders['p0']!.schemeHand).toEqual([]);
  });
});
