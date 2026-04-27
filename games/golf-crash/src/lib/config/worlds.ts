import type { WorldId } from "$lib/game/entities/Background";

export type WorldConfig = {
  id: WorldId;
  hourRange: [number, number] | null;
};

export const WORLDS: WorldConfig[] = [
  { id: "sunny", hourRange: [6, 17] },
  { id: "golden", hourRange: [17, 20] },
  { id: "night", hourRange: [20, 6] },
  { id: "space", hourRange: null },
  { id: "desert", hourRange: null },
  { id: "jungle", hourRange: null },
];

export const pickWorldByHour = (hour: number): WorldId => {
  if (hour >= 6 && hour < 17) return "sunny";
  if (hour >= 17 && hour < 20) return "golden";
  return "night";
};
