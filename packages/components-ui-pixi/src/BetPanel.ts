export type BetPanelProps = {
  betMicro: number;
  minMicro: number;
  maxMicro: number;
  stepMicro: number;
  onChange: (nextMicro: number) => void;
};

export const createBetPanel = (_props: BetPanelProps): unknown => {
  throw new Error("BetPanel not implemented");
};
