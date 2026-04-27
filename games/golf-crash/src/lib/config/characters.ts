export type CharacterId =
  | "cryptoKing"
  | "sheikh"
  | "dictator"
  | "muscleMan"
  | "bigBoss"
  | "glamQueen"
  | "iceLady";

export type CharacterDef = {
  id: CharacterId;
  displayName: string;
  clubName: string;
};

export const CHARACTERS: CharacterDef[] = [
  { id: "cryptoKing", displayName: "CryptoKing", clubName: "Crypto Club" },
  { id: "sheikh", displayName: "The Sheikh", clubName: "Ruby Club" },
  { id: "dictator", displayName: "The Dictator", clubName: "Rocket Club" },
  { id: "muscleMan", displayName: "Muscle Man", clubName: "Iron Club" },
  { id: "bigBoss", displayName: "Big Boss", clubName: "WINNER Club" },
  { id: "glamQueen", displayName: "Glam Queen", clubName: "Diamond Club" },
  { id: "iceLady", displayName: "Ice Lady", clubName: "Crystal Club" },
];
