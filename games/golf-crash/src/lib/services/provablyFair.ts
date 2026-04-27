export type ProvablyFairProof = {
  serverSeedHash: string;
  serverSeed?: string;
  clientSeed: string;
  nonce: number;
  expectedCrashMultiplier?: number;
  expectedOutcome?: "preShotFail" | "holeInOne" | "crash";
  expectedLandingZone?: "fairway" | "sand" | "water" | "cart" | "hole";
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const sha256Hex = async (value: string): Promise<string> => {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(hash));
};

export const verify = async (proof: ProvablyFairProof): Promise<boolean> => {
  if (!proof.serverSeed) return false;
  const seedHash = await sha256Hex(proof.serverSeed);
  if (seedHash !== proof.serverSeedHash && proof.serverSeed !== proof.serverSeedHash) return false;

  const { generatePlan } = await import("../game/math.js");
  const plan = await generatePlan({
    serverSeed: proof.serverSeed,
    clientSeed: proof.clientSeed,
    nonce: proof.nonce,
  });

  if (proof.expectedOutcome && plan.outcome !== proof.expectedOutcome) return false;
  if (proof.expectedLandingZone && plan.landingZone !== proof.expectedLandingZone) return false;
  if (
    proof.expectedCrashMultiplier !== undefined &&
    Math.abs(plan.crashMultiplier - proof.expectedCrashMultiplier) > 0.0001
  ) {
    return false;
  }
  return true;
};
