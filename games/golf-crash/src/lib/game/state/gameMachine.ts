import { setup } from "xstate";

export type LandingZone = "fairway" | "sand" | "water" | "cart";

export type GameContext = {
  betMicro: number;
  multiplier: number;
  balanceMicro: number;
  selectedCharacterId: string | null;
};

export type GameEvent =
  | { type: "CHARACTER_SELECTED"; characterId: string }
  | { type: "SHOOT" }
  | { type: "CASH_OUT" }
  | { type: "LANDED"; zone: LandingZone }
  | { type: "BONUS_TRIGGER" }
  | { type: "HOLE_REACHED" }
  | { type: "ROUND_END" };

export const gameMachine = setup({
  types: {} as { context: GameContext; events: GameEvent },
}).createMachine({
  id: "golfCrash",
  initial: "characterSelect",
  context: {
    betMicro: 100_000,
    multiplier: 1,
    balanceMicro: 0,
    selectedCharacterId: null,
  },
  states: {
    characterSelect: {
      on: { CHARACTER_SELECTED: "idle" },
    },
    idle: {
      on: { SHOOT: "preShot" },
    },
    preShot: {
      on: { SHOOT: "flight" },
    },
    flight: {
      on: {
        CASH_OUT: "cashOut",
        BONUS_TRIGGER: "bonusRound",
        LANDED: "landed",
      },
    },
    landed: {
      on: {
        SHOOT: "preShot",
        CASH_OUT: "cashOut",
        HOLE_REACHED: "holeChallenge",
      },
    },
    holeChallenge: {
      on: { CASH_OUT: "cashOut", SHOOT: "flight" },
    },
    bonusRound: {
      on: { CASH_OUT: "cashOut", LANDED: "lose" },
    },
    cashOut: {
      on: { ROUND_END: "idle" },
    },
    lose: {
      on: { ROUND_END: "idle" },
    },
  },
});
