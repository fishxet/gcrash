import type { WorldId } from "./entities/Background.js";

export type MapFeatureType = "water" | "sand" | "bush" | "tree" | "cart" | "hole";

const GROUND_Y = 4000;
const FINAL_HOLE_X = 6900;

export type MapFeature = {
  id: string;
  type: MapFeatureType;
  x: number;
  y: number;
  scale: number;
  asset?: string;
  alpha?: number;
  flip?: boolean;
  hazardLevelY?: number;
  leftEdgeX?: number;
  rightEdgeX?: number;
};

export type LandingZone = {
  id: string;
  type: "fairway" | "sand" | "water" | "cart" | "hole";
  x: number;
  y: number;
  radius: number;
  featureId?: string;
};

export type MapLayout = {
  id: WorldId;
  seed: string;
  start: {
    ballX: number;
    ballY: number;
    characterX: number;
    characterY: number;
  };
  features: MapFeature[];
  landingZones: LandingZone[];
};

const feature = (
  id: string,
  type: MapFeatureType,
  x: number,
  y: number,
  scale: number,
  asset?: string,
  alpha = 1,
  flip = false,
): MapFeature => ({ id, type, x, y, scale, asset, alpha, flip });

export const hillSurfaceY = (x: number): number =>
  GROUND_Y -
  250 -
  Math.sin((x - 160) / 360) * 52 -
  Math.sin((x + 80) / 170) * 18;

const BASE_START = {
  ballX: 690,
  ballY: hillSurfaceY(690),
  characterX: 490,
  characterY: hillSurfaceY(490) - 72,
};

const findValleys = (fromX: number, toX: number, step = 40): Array<{ x: number; y: number }> => {
  const valleys: Array<{ x: number; y: number }> = [];

  for (let x = fromX + step; x < toX - step; x += step) {
    const left = hillSurfaceY(x - step);
    const mid = hillSurfaceY(x);
    const right = hillSurfaceY(x + step);

    if (mid > left && mid > right) {
      valleys.push({ x, y: mid });
    }
  }

  return valleys;
};

const findHazardEdges = (
  centerX: number,
  hazardLevelY: number,
  step = 5,
): { leftX: number; rightX: number } => {
  let leftX = centerX;
  let rightX = centerX;

  while (hillSurfaceY(leftX) > hazardLevelY) {
    leftX -= step;
    if (centerX - leftX > 1000) break;
  }

  while (hillSurfaceY(rightX) > hazardLevelY) {
    rightX += step;
    if (rightX - centerX > 1000) break;
  }

  return { leftX, rightX };
};

const terrainHazards = (worldId: "sunny" | "golden" | "night"): MapFeature[] => {
  const startSafeZoneEndX = BASE_START.ballX + 420;
  const valleys = findValleys(startSafeZoneEndX, FINAL_HOLE_X - 320).filter((point, index, all) => {
    const previous = all[index - 1];
    return !previous || point.x - previous.x > 360;
  });
  const alpha = worldId === "night" ? 0.62 : worldId === "golden" ? 0.8 : 0.9;

  return valleys.slice(0, 5).map((point, index) => {
    const isWater = index % 2 === 0;
    const asset = isWater
      ? (["waterTrap1", "waterTrap2", "waterTrap4"] as const)[index % 3]
      : (["sandTrap1", "sandTrap2"] as const)[index % 2];
    const hazardLevelY = point.y - (isWater ? 12 : 8);
    const edges = findHazardEdges(point.x, hazardLevelY);

    return {
      ...feature(
      `${isWater ? "water" : "sand"}-${Math.floor(index / 2) + 1}`,
      isWater ? "water" : "sand",
      point.x,
      point.y + (isWater ? 46 : 48),
      isWater ? 0.36 : 0.44,
      asset,
      alpha,
      ),
      hazardLevelY,
      leftEdgeX: edges.leftX,
      rightEdgeX: edges.rightX,
    };
  });
};

const baseLandingZones = (hazards: MapFeature[]): LandingZone[] => [
  { id: "fairway-1", type: "fairway", x: 980, y: hillSurfaceY(980), radius: 150 },
  { id: "fairway-2", type: "fairway", x: 1560, y: hillSurfaceY(1560), radius: 170 },
  { id: "fairway-3", type: "fairway", x: 2520, y: hillSurfaceY(2520), radius: 180 },
  { id: "fairway-4", type: "fairway", x: 4200, y: hillSurfaceY(4200), radius: 180 },
  { id: "fairway-5", type: "fairway", x: 5200, y: hillSurfaceY(5200), radius: 180 },
  { id: "fairway-6", type: "fairway", x: 6200, y: hillSurfaceY(6200), radius: 180 },
  ...hazards.map((hazard): LandingZone => ({
    id: hazard.id,
    type: hazard.type === "water" ? "water" : "sand",
    x: hazard.x,
    y: hazard.y,
    radius: hazard.type === "water" ? 150 : 130,
    featureId: hazard.id,
  })),
  { id: "cart-1", type: "cart", x: 1110, y: hillSurfaceY(1110), radius: 120, featureId: "cart" },
  { id: "hole", type: "hole", x: FINAL_HOLE_X, y: hillSurfaceY(FINAL_HOLE_X) + 8, radius: 80, featureId: "hole" },
];

const sunnyHazards = terrainHazards("sunny");
const goldenHazards = terrainHazards("golden");
const nightHazards = terrainHazards("night");

export const MAP_LAYOUTS: Record<WorldId, MapLayout> = {
  sunny: {
    id: "sunny",
    seed: "sunny-v1",
    start: BASE_START,
    features: [
      ...sunnyHazards,
      feature("cart", "cart", 1110, hillSurfaceY(1110), 0.4, "golfCar"),
      feature("hole", "hole", FINAL_HOLE_X, hillSurfaceY(FINAL_HOLE_X) + 8, 1),
      feature("tree-1", "tree", 310, 3060, 0.26, "midBush1", 0.42),
      feature("tree-2", "tree", 870, 2950, 0.22, "midBush2", 0.36),
      feature("tree-3", "tree", 1640, 3005, 0.24, "midBush3", 0.38),
      feature("bush-1", "bush", 120, 3930, 0.42, "frontBush1", 0.68),
      feature("bush-2", "bush", 610, 3915, 0.38, "frontBush2", 0.62),
    ],
    landingZones: baseLandingZones(sunnyHazards),
  },
  golden: {
    id: "golden",
    seed: "golden-v1",
    start: BASE_START,
    features: [
      ...goldenHazards,
      feature("cart", "cart", 1110, hillSurfaceY(1110), 0.4, "golfCar"),
      feature("hole", "hole", FINAL_HOLE_X, hillSurfaceY(FINAL_HOLE_X) + 8, 1),
      feature("tree-1", "tree", 260, 3030, 0.24, "midBush2", 0.36),
      feature("tree-2", "tree", 980, 2920, 0.23, "midBush1", 0.32),
      feature("tree-3", "tree", 1780, 3060, 0.22, "midBush3", 0.34),
      feature("bush-1", "bush", 120, 3930, 0.38, "frontBush1", 0.58),
    ],
    landingZones: baseLandingZones(goldenHazards),
  },
  night: {
    id: "night",
    seed: "night-v1",
    start: BASE_START,
    features: [
      ...nightHazards,
      feature("cart", "cart", 1110, hillSurfaceY(1110), 0.4, "golfCar", 0.85),
      feature("hole", "hole", FINAL_HOLE_X, hillSurfaceY(FINAL_HOLE_X) + 8, 1),
      feature("tree-1", "tree", 380, 3020, 0.22, "midBush1", 0.28),
      feature("tree-2", "tree", 1220, 2940, 0.2, "midBush3", 0.25),
      feature("tree-3", "tree", 1860, 3060, 0.22, "midBush2", 0.28),
    ],
    landingZones: baseLandingZones(nightHazards),
  },
  space: {
    id: "space",
    seed: "space-v1",
    start: BASE_START,
    features: [],
    landingZones: [],
  },
  desert: {
    id: "desert",
    seed: "desert-v1",
    start: BASE_START,
    features: [],
    landingZones: [],
  },
  jungle: {
    id: "jungle",
    seed: "jungle-v1",
    start: BASE_START,
    features: [],
    landingZones: [],
  },
};

export const getMapLayout = (worldId: WorldId): MapLayout =>
  MAP_LAYOUTS[worldId] ?? MAP_LAYOUTS.sunny;
