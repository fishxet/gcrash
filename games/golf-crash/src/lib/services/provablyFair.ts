export type ProvablyFairProof = {
  serverSeedHash: string;
  serverSeed?: string;
  clientSeed: string;
  nonce: number;
};

export const verify = async (_proof: ProvablyFairProof): Promise<boolean> => {
  throw new Error("verify not implemented");
};
