import { game } from "../stores/game.svelte.js";
import {
  generatePlan,
  multiplierAt,
  randomSeed,
  JACKPOT_MULT,
  type RoundPlan,
  type DecorativeEvent,
  type CrashCause,
  type PreShotFail,
} from "./math.js";

const RESET_DELAY_MS = 2000;
const PRE_SHOT_FAIL_DELAY_MS = 1800;
const JACKPOT_RESET_DELAY_MS = 2600;

let raf: number | null = null;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
let startedAt = 0;
let pendingPlan: RoundPlan | null = null;
let activePlan: RoundPlan | null = null;
let nextEventIdx = 0;
let prerolling = false;

type DecorativeListener = (event: DecorativeEvent) => void;
type CrashListener = (cause: CrashCause) => void;
type LandingListener = () => void;
type PreShotFailListener = (kind: PreShotFail) => void;

const decorativeListeners = new Set<DecorativeListener>();
const crashListeners = new Set<CrashListener>();
const landingListeners = new Set<LandingListener>();
const preShotFailListeners = new Set<PreShotFailListener>();

export const onDecorativeEvent = (h: DecorativeListener): (() => void) => {
  decorativeListeners.add(h);
  return () => {
    decorativeListeners.delete(h);
  };
};

export const onCrashCause = (h: CrashListener): (() => void) => {
  crashListeners.add(h);
  return () => {
    crashListeners.delete(h);
  };
};

export const onHoleLanding = (h: LandingListener): (() => void) => {
  landingListeners.add(h);
  return () => {
    landingListeners.delete(h);
  };
};

export const onPreShotFail = (h: PreShotFailListener): (() => void) => {
  preShotFailListeners.add(h);
  return () => {
    preShotFailListeners.delete(h);
  };
};

const fireDecorative = (e: DecorativeEvent): void => {
  for (const h of decorativeListeners) h(e);
};
const fireCrashCause = (c: CrashCause): void => {
  for (const h of crashListeners) h(c);
};
const fireLanding = (): void => {
  for (const h of landingListeners) h();
};
const firePreShotFail = (k: PreShotFail): void => {
  for (const h of preShotFailListeners) h(k);
};

const stopTicker = (): void => {
  if (raf !== null) {
    cancelAnimationFrame(raf);
    raf = null;
  }
};

const clearReset = (): void => {
  if (resetTimer !== null) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
};

export const prerollNextRound = async (): Promise<void> => {
  if (prerolling || pendingPlan) return;
  prerolling = true;
  try {
    pendingPlan = await generatePlan(randomSeed());
  } finally {
    prerolling = false;
  }
};

const scheduleReset = (delayMs = RESET_DELAY_MS): void => {
  clearReset();
  resetTimer = setTimeout(() => {
    resetTimer = null;
    activePlan = null;
    nextEventIdx = 0;
    game.phase = "idle";
    game.multiplier = 1;
    game.winningsMicro = 0;
    game.crashAt = 0;
    game.crashCause = null;
    game.preShotFail = null;
    game.isJackpot = false;
    void prerollNextRound();
  }, delayMs);
};

const finishCrash = (cause: CrashCause): void => {
  stopTicker();
  game.phase = "crashed";
  game.multiplier = game.crashAt;
  game.winningsMicro = 0;
  game.crashCause = cause;
  game.history = [...game.history.slice(-6), "water"];
  fireCrashCause(cause);
  scheduleReset();
};

const finishHoleInOne = (): void => {
  stopTicker();
  const payout = Math.round(game.betMicro * JACKPOT_MULT);
  game.multiplier = JACKPOT_MULT;
  game.winningsMicro = payout;
  game.balanceMicro += payout;
  game.phase = "landed";
  game.isJackpot = true;
  game.history = [...game.history.slice(-6), "jackpot"];
  fireLanding();
  scheduleReset(JACKPOT_RESET_DELAY_MS);
};

export const startRound = (): void => {
  if (game.phase !== "idle") return;
  if (!pendingPlan) {
    void prerollNextRound();
    return;
  }
  if (game.balanceMicro < game.betMicro) return;
  if (game.betMicro <= 0) return;

  clearReset();

  activePlan = pendingPlan;
  pendingPlan = null;
  nextEventIdx = 0;

  game.balanceMicro -= game.betMicro;
  game.multiplier = 1;
  game.winningsMicro = 0;
  game.crashCause = null;
  game.preShotFail = null;
  game.isJackpot = false;

  if (activePlan.outcome === "preShotFail" && activePlan.preShotFail !== null) {
    game.preShotFail = activePlan.preShotFail;
    game.phase = "lose";
    game.crashAt = 1;
    game.history = [...game.history.slice(-6), "sand"];
    firePreShotFail(activePlan.preShotFail);
    scheduleReset(PRE_SHOT_FAIL_DELAY_MS);
    return;
  }

  game.crashAt = activePlan.crashMultiplier;
  game.phase = "flight";
  startedAt = performance.now();

  const tick = (): void => {
    if (game.phase !== "flight" || !activePlan) {
      raf = null;
      return;
    }
    const elapsed = (performance.now() - startedAt) / 1000;

    while (
      nextEventIdx < activePlan.decorativeEvents.length &&
      activePlan.decorativeEvents[nextEventIdx]!.atSec <= elapsed
    ) {
      fireDecorative(activePlan.decorativeEvents[nextEventIdx]!);
      nextEventIdx += 1;
    }

    const m = multiplierAt(elapsed);
    if (m >= game.crashAt) {
      game.multiplier = game.crashAt;
      if (activePlan.outcome === "holeInOne") {
        finishHoleInOne();
      } else if (activePlan.crashCause !== null) {
        finishCrash(activePlan.crashCause);
      }
      return;
    }
    game.multiplier = m;
    game.winningsMicro = Math.round(game.betMicro * m);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
};

export const cashOut = (): void => {
  if (game.phase !== "flight") return;
  stopTicker();
  const payout = Math.round(game.betMicro * game.multiplier);
  game.winningsMicro = payout;
  game.balanceMicro += payout;
  game.phase = "cashOut";
  game.history = [...game.history.slice(-6), "cashout"];
  scheduleReset();
};

export const teardownRound = (): void => {
  stopTicker();
  clearReset();
  pendingPlan = null;
  activePlan = null;
  nextEventIdx = 0;
  prerolling = false;
  decorativeListeners.clear();
  crashListeners.clear();
  landingListeners.clear();
  preShotFailListeners.clear();
};
