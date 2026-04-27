export type SessionInfo = {
  sessionId: string;
  balanceMicro: number;
  currency: string;
  betLevels: number[];
  rgsUrl: string;
};

export type SpinState = {
  roundId: string;
  finalMultiplier: number;
  events: unknown[];
};

export const authenticate = async (
  _rgsUrl: string,
  _sessionId: string,
): Promise<SessionInfo> => {
  throw new Error("authenticate not implemented");
};

export const placeBet = async (_betMicro: number): Promise<SpinState> => {
  throw new Error("placeBet not implemented");
};

export const claimWin = async (_roundId: string): Promise<{ balanceMicro: number }> => {
  throw new Error("claimWin not implemented");
};
