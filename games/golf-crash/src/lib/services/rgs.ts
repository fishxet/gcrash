import {
  timeForMultiplier,
  type CrashCause,
  type DecorativeEvent,
  type LandingZone,
  type PreShotFail,
  type RoundOutcomeKind,
  type RoundPlan,
} from "../game/math.js";

export type SessionInfo = {
  sessionId: string;
  balanceMicro: number;
  currency: string;
  betLevels: number[];
  defaultBetLevel?: number;
  minBet?: number;
  maxBet?: number;
  stepBet?: number;
  jurisdictionFlags?: Record<string, unknown>;
  activeRoundPlan?: RoundPlan;
  activeRoundId?: string;
  rgsUrl: string;
};

export type SpinState = {
  roundId: string;
  finalMultiplier: number;
  events: unknown[];
  roundPlan?: RoundPlan;
  roundActive?: boolean;
  landingZone?: string;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
  balanceMicro?: number;
};

type RgsConfig = {
  rgsUrl: string | null;
  sessionId: string | null;
  demoMode: boolean;
};

let config: RgsConfig = {
  rgsUrl: null,
  sessionId: null,
  demoMode: true,
};

let cachedSession: SessionInfo | null = null;
let mockBalanceMicro = 300_000;

export const configureRgs = (next: Partial<RgsConfig>): void => {
  config = { ...config, ...next };
  if (next.sessionId || next.rgsUrl || next.demoMode !== undefined) cachedSession = null;
};

export const isDemoRgs = (): boolean => config.demoMode || !config.rgsUrl || !config.sessionId;

const normalizeRgsUrl = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

const endpoint = (path: string): string => {
  if (!config.rgsUrl) throw new Error("RGS URL is not configured");
  return `${normalizeRgsUrl(config.rgsUrl).replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

const postJson = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  const response = await fetch(endpoint(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RGS ${path} failed (${response.status}): ${text || response.statusText}`);
  }
  return (await response.json()) as T;
};

const ensureSession = (): string => {
  if (!config.sessionId) throw new Error("RGS sessionId is not configured");
  return config.sessionId;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const normalizeOutcome = (value: unknown): RoundOutcomeKind | undefined =>
  value === "preShotFail" || value === "holeInOne" || value === "crash" ? value : undefined;

const normalizeLandingZone = (value: unknown): LandingZone | undefined =>
  value === "fairway" || value === "sand" || value === "water" || value === "cart" || value === "hole"
    ? value
    : undefined;

const normalizeCrashCause = (value: unknown): CrashCause | null | undefined =>
  value === null
    ? null
    : value === "bird" ||
        value === "wind" ||
        value === "helicopter" ||
        value === "plane" ||
        value === "cart" ||
        value === "timeout" ||
        value === "fakeBoost"
      ? value
      : undefined;

const normalizePreShotFail = (value: unknown): PreShotFail | null | undefined =>
  value === null
    ? null
    : value === "mole" || value === "clubBreak" || value === "selfHit"
      ? value
      : undefined;

const normalizeDecorativeEvents = (value: unknown): DecorativeEvent[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((event): DecorativeEvent[] => {
    if (!isRecord(event)) return [];
    const kind = normalizeCrashCause(event.kind);
    const atSec = asNumber(event.atSec);
    if (
      kind === null ||
      kind === undefined ||
      kind === "timeout" ||
      kind === "fakeBoost" ||
      atSec === undefined
    ) {
      return [];
    }
    return [{ kind, atSec }];
  });
};

const stateCandidate = (state: unknown): Record<string, unknown> | null => {
  if (!isRecord(state)) return null;
  for (const key of ["plan", "roundPlan", "golfCrash", "state"]) {
    const nested = state[key];
    if (isRecord(nested) && ("finalMultiplier" in nested || "crashMultiplier" in nested)) return nested;
  }
  return state;
};

const roundPlanFromState = (state: unknown, fallbackRoundId: string): RoundPlan | undefined => {
  const source = stateCandidate(state);
  if (!source) return undefined;

  const finalMultiplier = asNumber(source.finalMultiplier) ?? asNumber(source.payoutMultiplier);
  const crashMultiplier = asNumber(source.crashMultiplier) ?? finalMultiplier;
  const outcome = normalizeOutcome(source.outcome);
  const landingZone = normalizeLandingZone(source.landingZone);
  const crashCause = normalizeCrashCause(source.crashCause);
  const preShotFail = normalizePreShotFail(source.preShotFail);

  if (
    finalMultiplier === undefined ||
    crashMultiplier === undefined ||
    outcome === undefined ||
    landingZone === undefined ||
    crashCause === undefined ||
    preShotFail === undefined
  ) {
    return undefined;
  }

  const seedSource = isRecord(source.seed) ? source.seed : source;
  const seed = {
    serverSeed: asString(seedSource.serverSeed) ?? "",
    clientSeed: asString(seedSource.clientSeed) ?? "",
    nonce: asNumber(seedSource.nonce) ?? 0,
  };

  return {
    roundId: asString(source.roundId) ?? fallbackRoundId,
    seed,
    serverSeedHash: asString(source.serverSeedHash) ?? "",
    finalMultiplier,
    outcome,
    landingZone,
    crashMultiplier,
    crashAtSec: asNumber(source.crashAtSec) ?? timeForMultiplier(crashMultiplier),
    preShotFail,
    crashCause,
    decorativeEvents: normalizeDecorativeEvents(source.decorativeEvents),
  };
};

type StakeBalance = {
  amount?: number;
  currency?: string;
};

type StakeRound = {
  betID?: number;
  id?: string | number;
  active?: boolean;
  state?: unknown;
  payoutMultiplier?: number;
};

const balanceAmount = (balance: StakeBalance | undefined): number => balance?.amount ?? 0;

const roundId = (round: StakeRound | undefined): string =>
  round?.betID !== undefined
    ? `bet-${round.betID}`
    : round?.id !== undefined
      ? String(round.id)
      : `rgs-round-${Date.now()}`;

export const authenticate = async (rgsUrl?: string, sessionId?: string): Promise<SessionInfo> => {
  if (rgsUrl !== undefined || sessionId !== undefined) {
    configureRgs({ rgsUrl: rgsUrl ?? config.rgsUrl, sessionId: sessionId ?? config.sessionId });
  }
  if (cachedSession) return cachedSession;

  if (config.demoMode || !config.rgsUrl || !config.sessionId) {
    cachedSession = {
      sessionId: config.sessionId ?? "demo-session",
      balanceMicro: mockBalanceMicro,
      currency: "USD",
      betLevels: [100_000, 200_000, 400_000, 800_000],
      rgsUrl: config.rgsUrl ?? "demo://local-wallet",
    };
    return cachedSession;
  }

  type AuthResponse = {
    balance?: StakeBalance;
    config?: {
      minBet?: number;
      maxBet?: number;
      stepBet?: number;
      defaultBetLevel?: number;
      betLevels?: number[];
      jurisdiction?: Record<string, unknown>;
    };
    jurisdictionFlags?: Record<string, unknown>;
    round?: StakeRound;
  };
  const payload = await postJson<AuthResponse>("wallet/authenticate", { sessionID: ensureSession() });
  const activeRoundId = roundId(payload.round);
  const activeRoundPlan =
    payload.round?.active === true ? roundPlanFromState(payload.round.state, activeRoundId) : undefined;
  cachedSession = {
    sessionId: ensureSession(),
    balanceMicro: balanceAmount(payload.balance),
    currency: payload.balance?.currency ?? "USD",
    betLevels: payload.config?.betLevels ?? [],
    defaultBetLevel: payload.config?.defaultBetLevel,
    minBet: payload.config?.minBet,
    maxBet: payload.config?.maxBet,
    stepBet: payload.config?.stepBet,
    jurisdictionFlags: payload.jurisdictionFlags ?? payload.config?.jurisdiction,
    activeRoundPlan,
    activeRoundId: activeRoundPlan ? activeRoundId : undefined,
    rgsUrl: config.rgsUrl,
  };
  return cachedSession;
};

export const placeBet = async (betMicro: number, mode = "BASE"): Promise<SpinState> => {
  if (config.demoMode || !config.rgsUrl || !config.sessionId) {
    if (betMicro > mockBalanceMicro) throw new Error("Insufficient demo balance");
    mockBalanceMicro -= betMicro;
    return {
      roundId: `demo-round-${Date.now()}`,
      finalMultiplier: 0,
      events: [],
      balanceMicro: mockBalanceMicro,
    };
  }
  type PlayResponse = { balance?: StakeBalance; round?: StakeRound; events?: unknown[] };
  const payload = await postJson<PlayResponse>("wallet/play", {
    sessionID: ensureSession(),
    amount: betMicro,
    mode,
  });
  const id = roundId(payload.round);
  const plan = roundPlanFromState(payload.round?.state, id);
  return {
    roundId: id,
    finalMultiplier: plan?.finalMultiplier ?? payload.round?.payoutMultiplier ?? 0,
    events: payload.events ?? [],
    roundPlan: plan,
    roundActive: payload.round?.active,
    landingZone: plan?.landingZone,
    serverSeedHash: plan?.serverSeedHash,
    clientSeed: plan?.seed.clientSeed,
    nonce: plan?.seed.nonce,
    balanceMicro: payload.balance?.amount,
  };
};

export const endRound = async (winMicro = 0): Promise<{ balanceMicro: number }> => {
  if (config.demoMode || !config.rgsUrl || !config.sessionId) {
    mockBalanceMicro += Math.max(0, winMicro);
    return { balanceMicro: mockBalanceMicro };
  }
  type EndRoundResponse = { balance?: StakeBalance };
  const payload = await postJson<EndRoundResponse>("wallet/end-round", { sessionID: ensureSession() });
  return {
    balanceMicro: balanceAmount(payload.balance),
  };
};

export const trackEvent = async (event: string): Promise<void> => {
  if (config.demoMode || !config.rgsUrl || !config.sessionId) return;
  await postJson<{ event?: string }>("bet/event", { sessionID: ensureSession(), event });
};
