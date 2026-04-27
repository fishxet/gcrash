import {
  MIN_BET_MICRO,
  MAX_BET_MICRO,
  STEP_BET_MICRO,
} from "@golf-crash/utils-shared";
import type { CrashCause, PreShotFail } from "../game/math.js";
import type { AppLang } from "../i18n.js";

export type RoundOutcome = "fairway" | "sand" | "water" | "cashout" | "jackpot";

export type GamePhase =
  | "idle"
  | "preShot"
  | "flight"
  | "runToBall"
  | "landed"
  | "cashOut"
  | "crashed"
  | "lose";

export type GameState = {
  balanceMicro: number;
  betMicro: number;
  currency: string;
  multiplier: number;
  winningsMicro: number;
  characterId: string;
  characterDisplayName: string;
  phase: GamePhase;
  history: RoundOutcome[];
  crashAt: number;
  crashCause: CrashCause | null;
  preShotFail: PreShotFail | null;
  isJackpot: boolean;
  lang: AppLang;
  demoMode: boolean;
  lastError: string | null;
};

export const game: GameState = $state({
  balanceMicro: 300_000,
  betMicro: 100_000,
  currency: "USD",
  multiplier: 1,
  winningsMicro: 0,
  characterId: "sheikh",
  characterDisplayName: "The Sheikh",
  phase: "idle",
  history: ["fairway", "fairway", "water", "sand", "fairway", "fairway", "water"],
  crashAt: 0,
  crashCause: null,
  preShotFail: null,
  isJackpot: false,
  lang: "en",
  demoMode: true,
  lastError: null,
});

export const adjustBet = (delta: number): void => {
  const next = Math.min(
    MAX_BET_MICRO,
    Math.max(MIN_BET_MICRO, game.betMicro + delta * STEP_BET_MICRO),
  );
  game.betMicro = next;
};

export const setBet = (micro: number): void => {
  game.betMicro = Math.min(MAX_BET_MICRO, Math.max(MIN_BET_MICRO, micro));
};
