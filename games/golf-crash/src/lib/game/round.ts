import { game } from "../stores/game.svelte.js";
import { getRuntimeConfig } from "../runtime.js";
import { authenticate, configureRgs, endRound, isDemoRgs, placeBet, trackEvent } from "../services/rgs.js";
import { verify } from "../services/provablyFair.js";
import {
  generatePlan,
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
const RUN_TO_BALL_DELAY_MS = 2000;

let raf: number | null = null;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
let crashResolveTimer: ReturnType<typeof setTimeout> | null = null;
let landingTimer: ReturnType<typeof setTimeout> | null = null;
let startedAt = 0;
let pendingPlan: RoundPlan | null = null;
let activePlan: RoundPlan | null = null;
let nextEventIdx = 0;
let prerolling = false;
let activeRoundId: string | null = null;
let walletReady = false;
let resolvingCrash = false;
let flightStartMultiplier = 1;
let primaryImpactFired = false;

type DecorativeListener = (event: DecorativeEvent) => void;
type CrashListener = (cause: CrashCause) => void;
type LandingListener = () => void;
type PreShotFailListener = (kind: PreShotFail) => void;
type RoundPlanListener = (plan: RoundPlan) => void;

const decorativeListeners = new Set<DecorativeListener>();
const crashListeners = new Set<CrashListener>();
const landingListeners = new Set<LandingListener>();
const preShotFailListeners = new Set<PreShotFailListener>();
const roundPlanListeners = new Set<RoundPlanListener>();

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

export const onRoundPlanReady = (h: RoundPlanListener): (() => void) => {
  roundPlanListeners.add(h);
  if (pendingPlan) h(pendingPlan);
  return () => {
    roundPlanListeners.delete(h);
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
const fireRoundPlanReady = (plan: RoundPlan): void => {
  for (const h of roundPlanListeners) h(plan);
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

const clearCrashResolve = (): void => {
  if (crashResolveTimer !== null) {
    clearTimeout(crashResolveTimer);
    crashResolveTimer = null;
  }
  resolvingCrash = false;
};

const clearLandingTimer = (): void => {
  if (landingTimer !== null) {
    clearTimeout(landingTimer);
    landingTimer = null;
  }
};

const reportWalletError = (error: unknown): void => {
  game.lastError = error instanceof Error ? error.message : "Wallet operation failed";
};

const logShootPlan = (plan: RoundPlan): void => {
  console.info("[GolfCrash] SHOOT", {
    roundId: plan.roundId,
    betMicro: game.betMicro,
    bet: game.betMicro / 1_000_000,
    currency: game.currency,
    continueFromMultiplier: flightStartMultiplier,
    outcome: plan.outcome,
    crashMultiplier: plan.crashMultiplier,
    targetMultiplier: game.crashAt,
    crashAtSec: plan.crashAtSec,
    landingZone: plan.landingZone,
    crashCause: plan.crashCause,
    preShotFail: plan.preShotFail,
  });
};

const ensureWallet = async (): Promise<void> => {
  if (walletReady) return;
  const cfg = getRuntimeConfig();
  configureRgs({
    demoMode: cfg.demo,
    rgsUrl: cfg.rgsUrl,
    sessionId: cfg.sessionId,
  });
  const session = await authenticate();
  game.balanceMicro = session.balanceMicro;
  game.currency = session.currency;
  if (session.betLevels.length > 0 && !session.betLevels.includes(game.betMicro)) {
    game.betMicro = session.defaultBetLevel ?? session.betLevels[0]!;
  }
  if (session.activeRoundPlan && !pendingPlan && !activePlan) {
    pendingPlan = session.activeRoundPlan;
    activeRoundId = session.activeRoundId ?? pendingPlan.roundId;
    game.crashAt = pendingPlan.finalMultiplier;
    fireRoundPlanReady(pendingPlan);
  }
  game.lastError = null;
  walletReady = true;
};

const settleWin = async (winMicro: number): Promise<void> => {
  if (!activeRoundId) return;
  try {
    const settlement = await endRound(winMicro);
    game.balanceMicro = settlement.balanceMicro;
    game.lastError = null;
  } catch (error) {
    reportWalletError(error);
  } finally {
    activeRoundId = null;
  }
};

export const prerollNextRound = async (): Promise<void> => {
  if (prerolling || pendingPlan) return;
  prerolling = true;
  try {
    await ensureWallet();
    if (!isDemoRgs()) return;
    pendingPlan = await generatePlan(randomSeed());
    game.crashAt = pendingPlan.finalMultiplier;
    fireRoundPlanReady(pendingPlan);
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
  crashResolveTimer = null;
  resolvingCrash = false;
  stopTicker();
  game.phase = "crashed";
  game.multiplier = game.crashAt;
  game.winningsMicro = 0;
  game.crashCause = cause;
  game.history = [...game.history.slice(-6), activePlan?.landingZone === "sand" ? "sand" : "water"];
  void trackEvent(`crash:${cause}`);
  void settleWin(0);
  scheduleReset();
};

const isZeroCrash = (plan: RoundPlan): boolean =>
  plan.landingZone === "water" || plan.crashCause === "timeout" || plan.crashCause === "fakeBoost";

const impactCauseForPlan = (plan: RoundPlan): CrashCause | null =>
  plan.crashCause ?? (plan.landingZone === "cart" ? "cart" : null);

const beginCrashResolution = (cause: CrashCause): void => {
  if (resolvingCrash) return;
  resolvingCrash = true;
  stopTicker();
  game.multiplier = game.crashAt;
  game.winningsMicro = 0;
  game.crashCause = cause;
  fireCrashCause(cause);
  crashResolveTimer = setTimeout(() => finishCrash(cause), 700);
};

const finishSafeLanding = (): void => {
  landingTimer = null;
  game.phase = "landed";
  if (activePlan?.landingZone !== "sand") void prerollNextRound();
};

const beginSafeLanding = (): void => {
  stopTicker();
  game.phase = "runToBall";
  game.winningsMicro = Math.round(game.betMicro * game.multiplier);
  const zone = activePlan?.landingZone;
  game.history = [
    ...game.history.slice(-6),
    zone === "sand" ? "sand" : zone === "cart" ? "fairway" : "fairway",
  ];
  void trackEvent(`landed:${zone ?? "fairway"}`);
  landingTimer = setTimeout(finishSafeLanding, RUN_TO_BALL_DELAY_MS);
};

const finishHoleInOne = (): void => {
  stopTicker();
  const payoutMultiplier = game.crashAt > 0 ? game.crashAt : flightStartMultiplier * JACKPOT_MULT;
  const payout = Math.round(game.betMicro * payoutMultiplier);
  game.multiplier = payoutMultiplier;
  game.winningsMicro = payout;
  void settleWin(payout);
  game.phase = "landed";
  game.isJackpot = true;
  game.history = [...game.history.slice(-6), "jackpot"];
  void trackEvent("hole-in-one");
  fireLanding();
  scheduleReset(JACKPOT_RESET_DELAY_MS);
};

export const startRound = async (): Promise<void> => {
  if (game.phase !== "idle" && game.phase !== "landed") return;
  const isContinuation = game.phase === "landed" && activeRoundId !== null && !game.isJackpot;
  if (game.phase === "landed" && activePlan?.landingZone === "sand") {
    game.lastError = "Ball is stuck in sand. Cash out to finish the round.";
    return;
  }
  if (game.betMicro <= 0) return;

  try {
    await ensureWallet();
  } catch (error) {
    reportWalletError(error);
    return;
  }

  if (!pendingPlan && isDemoRgs()) {
    await prerollNextRound();
  }
  if (!pendingPlan && isDemoRgs()) {
    return;
  }
  if (!isContinuation && game.balanceMicro < game.betMicro) {
    game.lastError = "Insufficient balance";
    return;
  }

  try {
    const spin =
      isContinuation && pendingPlan
        ? null
        : isContinuation
          ? await placeBet(0, "CONTINUE")
          : await placeBet(game.betMicro);
    const plan = spin?.roundPlan ?? pendingPlan;
    if (!plan) {
      game.lastError = "RGS round.state did not include a Golf Crash round plan";
      if (spin?.roundActive) void endRound(0);
      return;
    }
    activeRoundId = activeRoundId ?? spin?.roundId ?? plan.roundId;
    activePlan = plan;
    if (spin?.balanceMicro !== undefined) game.balanceMicro = spin.balanceMicro;
    fireRoundPlanReady(activePlan);
    void trackEvent(`shoot:${activeRoundId}`);
    game.lastError = null;
  } catch (error) {
    reportWalletError(error);
    return;
  }

  clearReset();
  clearCrashResolve();
  clearLandingTimer();

  pendingPlan = null;
  nextEventIdx = 0;
    primaryImpactFired = false;

    flightStartMultiplier = isContinuation ? game.multiplier : 1;
    game.multiplier = flightStartMultiplier;
    game.winningsMicro = Math.round(game.betMicro * flightStartMultiplier);
  game.crashCause = null;
  game.preShotFail = null;
  game.isJackpot = activePlan.outcome === "holeInOne";
    game.crashAt =
      activePlan.outcome === "preShotFail" ? 1 : flightStartMultiplier * activePlan.crashMultiplier;
  logShootPlan(activePlan);

  if (activePlan.outcome === "preShotFail" && activePlan.preShotFail !== null) {
    game.preShotFail = activePlan.preShotFail;
    game.phase = "lose";
    game.crashAt = 1;
    game.history = [...game.history.slice(-6), "water"];
    firePreShotFail(activePlan.preShotFail);
    void settleWin(0);
    scheduleReset(PRE_SHOT_FAIL_DELAY_MS);
    return;
  }

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

    const duration = Math.max(5, activePlan.crashAtSec);
    const primaryImpactAt = duration * 0.68;
    const progress = Math.min(1, elapsed / duration);
    const m = flightStartMultiplier + (game.crashAt - flightStartMultiplier) * progress;
    if (
      !primaryImpactFired &&
      elapsed >= primaryImpactAt &&
      activePlan.outcome === "crash" &&
      impactCauseForPlan(activePlan) !== null &&
      !isZeroCrash(activePlan)
    ) {
      primaryImpactFired = true;
      fireCrashCause(impactCauseForPlan(activePlan)!);
    }
    if (elapsed >= duration) {
      game.multiplier = game.crashAt;
      if (activePlan.outcome === "holeInOne") {
        finishHoleInOne();
      } else if (activePlan.outcome === "crash" && activePlan.crashCause !== null && isZeroCrash(activePlan)) {
        beginCrashResolution(activePlan.crashCause);
      } else if (activePlan.landingZone !== "water" && activePlan.landingZone !== "hole") {
        beginSafeLanding();
      }
      return;
    }
    game.multiplier = m;
    game.winningsMicro = Math.round(game.betMicro * m);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
};

export const cashOut = async (): Promise<void> => {
  if ((game.phase !== "flight" && game.phase !== "landed") || resolvingCrash) return;
  stopTicker();
  clearCrashResolve();
  clearLandingTimer();
  const payout = Math.round(game.betMicro * game.multiplier);
  game.winningsMicro = payout;
  void trackEvent(`cashout:${game.multiplier.toFixed(2)}`);
  await settleWin(payout);
  game.phase = "cashOut";
  game.history = [...game.history.slice(-6), "cashout"];

  if (activePlan?.serverSeedHash && activePlan.seed.serverSeed && activePlan.seed.clientSeed) {
    const proofOk = await verify({
      serverSeedHash: activePlan.serverSeedHash,
      serverSeed: activePlan.seed.serverSeed,
      clientSeed: activePlan.seed.clientSeed,
      nonce: activePlan.seed.nonce,
      expectedCrashMultiplier: activePlan.crashMultiplier,
      expectedOutcome: activePlan.outcome,
      expectedLandingZone: activePlan.landingZone,
    });
    if (!proofOk) game.lastError = "Provably fair verification failed";
  }

  scheduleReset();
};

export const teardownRound = (): void => {
  stopTicker();
  clearReset();
  clearCrashResolve();
  clearLandingTimer();
  pendingPlan = null;
  activePlan = null;
  nextEventIdx = 0;
  prerolling = false;
  activeRoundId = null;
  walletReady = false;
  decorativeListeners.clear();
  crashListeners.clear();
  landingListeners.clear();
  preShotFailListeners.clear();
  roundPlanListeners.clear();
};
