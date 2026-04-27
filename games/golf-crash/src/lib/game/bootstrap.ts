import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  Ticker,
} from "pixi.js";
import { game } from "../stores/game.svelte.js";
import {
  onCrashCause,
  onDecorativeEvent,
  onHoleLanding,
  onPreShotFail,
  onRoundPlanReady,
  prerollNextRound,
  teardownRound,
} from "./round.js";
import type { CrashCause, DecorativeEvent, PreShotFail, RoundPlan } from "./math.js";
import { pickWorldByHour } from "../config/worlds.js";
import type { WorldId } from "./entities/Background.js";
import { getMapLayout, hillSurfaceY, type MapFeature, type MapLayout } from "./map.js";

const WORLD_W = 7600;
const WORLD_H = 4000;
const GROUND_Y = 4000;
const BACKGROUND_OVERSCAN_X = 2200;

const BALL_START_X = 690;
const BALL_START_Y = GROUND_Y - 90;
const BALL_APEX_Y = GROUND_Y - 1180;
const BALL_SPEED_X = 600;
const CHAR_X = BALL_START_X - 200;
const CAR_X = BALL_START_X + 420;
const FLAG_X = WORLD_W - 700;
const FLAG_Y = hillSurfaceY(FLAG_X) - 130;
const HOLE_X = FLAG_X;
const HOLE_Y = hillSurfaceY(HOLE_X) + 8;
const PLAY_END_X = HOLE_X;
const NEAR_HOLE_DISTANCE = 320;

type ObjectLayerId = 0 | 1 | 2 | 3 | 4 | 5;

const OBJECT_LAYERS: Record<ObjectLayerId, { name: string; centerY: number }> = {
  0: { name: "ground", centerY: GROUND_Y - 110 },
  1: { name: "low-air", centerY: GROUND_Y - 760 },
  2: { name: "mid-air", centerY: GROUND_Y - 1260 },
  3: { name: "high-air", centerY: GROUND_Y - 1880 },
  4: { name: "atmosphere", centerY: GROUND_Y - 2520 },
  5: { name: "space", centerY: GROUND_Y - 3240 },
};

const CRASH_LAYER: Record<CrashCause, ObjectLayerId> = {
  cart: 0,
  wind: 1,
  bird: 1,
  helicopter: 2,
  plane: 3,
  timeout: 5,
  fakeBoost: 5,
};

const PLANNED_HAZARD_WIDTH = 150;

const MANIFEST = [
  { alias: "skyDay", src: "/assets/scene/sky_day.png" },
  { alias: "skyEvening", src: "/assets/scene/sky_evening.png" },
  { alias: "skyNight", src: "/assets/scene/sky_night.png" },
  { alias: "starsOverlay", src: "/assets/scene/stars_overlay.png" },
  { alias: "sun", src: "/assets/scene/sun.png" },
  { alias: "moon", src: "/assets/scene/moon.png" },
  { alias: "back", src: "/assets/scene/back.png" },
  { alias: "middle", src: "/assets/scene/middle.png" },
  { alias: "front", src: "/assets/scene/front.png" },
  { alias: "back1", src: "/assets/scene/back_1.png" },
  { alias: "back2", src: "/assets/scene/back_2.png" },
  { alias: "back3", src: "/assets/scene/back_3.png" },
  { alias: "back4", src: "/assets/scene/back_4.png" },
  { alias: "back5", src: "/assets/scene/back_5.png" },
  { alias: "back6", src: "/assets/scene/back_6.png" },
  { alias: "middle1", src: "/assets/scene/middle_1.png" },
  { alias: "middle2", src: "/assets/scene/middle_2.png" },
  { alias: "middle3", src: "/assets/scene/middle_3.png" },
  { alias: "middle4", src: "/assets/scene/middle_4.png" },
  { alias: "middle5", src: "/assets/scene/middle_5.png" },
  { alias: "middle6", src: "/assets/scene/middle_6.png" },
  { alias: "front1", src: "/assets/scene/front_1.png" },
  { alias: "front2", src: "/assets/scene/front_2.png" },
  { alias: "front3", src: "/assets/scene/front_3.png" },
  { alias: "front4", src: "/assets/scene/front_4.png" },
  { alias: "front5", src: "/assets/scene/front_5.png" },
  { alias: "front6", src: "/assets/scene/front_6.png" },
  { alias: "frontBush1", src: "/assets/scene/front_bush_1.png" },
  { alias: "frontBush2", src: "/assets/scene/front_bush_2.png" },
  { alias: "waterTrap1", src: "/assets/scene/water_trap_1.png" },
  { alias: "waterTrap2", src: "/assets/scene/water_trap_2.png" },
  { alias: "waterTrap3", src: "/assets/scene/water_trap_3.png" },
  { alias: "waterTrap4", src: "/assets/scene/water_trap_4.png" },
  { alias: "sandTrap1", src: "/assets/scene/sand_trap_1.png" },
  { alias: "sandTrap2", src: "/assets/scene/sand_trap_2.png" },
  { alias: "midBush1", src: "/assets/scene/mid_bush_1.png" },
  { alias: "midBush2", src: "/assets/scene/mid_bush_2.png" },
  { alias: "midBush3", src: "/assets/scene/mid_bush_3.png" },
  { alias: "golfCar", src: "/assets/scene/golf_car.png" },
  { alias: "sheikh", src: "/assets/scene/sheikh.png" },
  { alias: "ball", src: "/assets/scene/simple_ball.png" },
  { alias: "fireBall", src: "/assets/scene/blue_fire_ball.png" },
  { alias: "holeFlag", src: "/assets/scene/hole_flag.png" },
  { alias: "bird", src: "/assets/scene/bird.png" },
  { alias: "duck", src: "/assets/scene/duck.png" },
  { alias: "duck2", src: "/assets/scene/duck2.png" },
  { alias: "plane", src: "/assets/scene/plane_skins.png" },
  { alias: "plane2", src: "/assets/scene/plane_skins2.png" },
  { alias: "plane3", src: "/assets/scene/plane_skins3.png" },
  { alias: "helicopter", src: "/assets/scene/helicopter_skins.png" },
  { alias: "helicopter2", src: "/assets/scene/helicopter_skins2.png" },
  { alias: "ufo", src: "/assets/scene/UFO.png" },
  { alias: "satellite", src: "/assets/scene/satellite.png" },
  { alias: "meteors", src: "/assets/scene/meteors.png" },
  { alias: "cloud1", src: "/assets/scene/cloud_1.png" },
  { alias: "cloud2", src: "/assets/scene/cloud_2.png" },
  { alias: "cloud3", src: "/assets/scene/cloud_3.png" },
  { alias: "cloud5", src: "/assets/scene/cloud_5.png" },
  { alias: "cloud7", src: "/assets/scene/cloud_7.png" },
  { alias: "cloud9", src: "/assets/scene/cloud_9.png" },
  { alias: "cloud10", src: "/assets/scene/cloud_10.png" },
];

type Mover = {
  sprite: Sprite;
  vx: number;
  vy: number;
  wrapMinX: number;
  wrapMaxX: number;
};

type Effect = {
  node: Container | Sprite;
  vx: number;
  vy: number;
  expiresAt: number;
};

type VisualWorld = Extract<WorldId, "sunny" | "golden" | "night">;

type VisualWorldTheme = {
  id: VisualWorld;
  skyAlias: string;
  celestialAlias: "sun" | "moon";
  celestialX: number;
  celestialY: number;
  celestialScale: number;
  celestialAlpha: number;
  starsAlpha: number;
  flyerAlpha: number;
  terrainTint: number;
};

const WORLD_THEMES: Record<VisualWorld, VisualWorldTheme> = {
  sunny: {
    id: "sunny",
    skyAlias: "skyDay",
    celestialAlias: "sun",
    celestialX: 3820,
    celestialY: 1180,
    celestialScale: 0.16,
    celestialAlpha: 0.7,
    starsAlpha: 0,
    flyerAlpha: 0.82,
    terrainTint: 0xffffff,
  },
  golden: {
    id: "golden",
    skyAlias: "skyEvening",
    celestialAlias: "sun",
    celestialX: 2550,
    celestialY: 3180,
    celestialScale: 0.18,
    celestialAlpha: 0.82,
    starsAlpha: 0.32,
    flyerAlpha: 0.75,
    terrainTint: 0xfff0c8,
  },
  night: {
    id: "night",
    skyAlias: "skyNight",
    celestialAlias: "moon",
    celestialX: 3680,
    celestialY: 920,
    celestialScale: 0.2,
    celestialAlpha: 0.78,
    starsAlpha: 0.58,
    flyerAlpha: 0.58,
    terrainTint: 0x8fa8d8,
  },
};

const currentVisualWorld = (): VisualWorld => {
  const id = pickWorldByHour(new Date().getHours());
  return id === "golden" || id === "night" ? id : "sunny";
};

const PRE_SHOT_FAIL_LABEL: Record<PreShotFail, string> = {
  mole: "A MOLE STOLE THE BALL!",
  clubBreak: "CLUB SNAPPED!",
  selfHit: "OUCH! SELF HIT!",
};

const CRASH_CAUSE_LABEL: Record<CrashCause, string> = {
  bird: "BIRD STRIKE!",
  wind: "GUST OF WIND!",
  helicopter: "HELICOPTER!",
  plane: "PLANE!",
  cart: "RUNAWAY CART!",
  timeout: "OUT OF GAS!",
  fakeBoost: "FAKE BOOST!",
};

const place = (sprite: Sprite, x: number, y: number, scale: number, anchor = 0.5): void => {
  sprite.anchor.set(anchor);
  sprite.scale.set(scale);
  sprite.x = x;
  sprite.y = y;
};

const setSpriteVisualWidth = (sprite: Sprite, width: number, flip = false): void => {
  const ratio = width / Math.max(1, sprite.texture.width);
  sprite.scale.set(ratio);
  if (flip) sprite.scale.x = -Math.abs(sprite.scale.x);
};

const buildSky = (): Graphics => {
  const g = new Graphics();
  const bands: Array<[number, number]> = [
    [0, 0x0b1230],
    [0.25, 0x1b2a5e],
    [0.5, 0x4a73c8],
    [0.75, 0xa0c8e8],
    [0.92, 0xffc88a],
    [1, 0xffd9a0],
  ];
  const segments = 80;
  const bandLerp = (t: number): number => {
    for (let i = 0; i < bands.length - 1; i++) {
      const [t0, c0] = bands[i]!;
      const [t1, c1] = bands[i + 1]!;
      if (t >= t0 && t <= t1) {
        const k = (t - t0) / (t1 - t0);
        const r = ((c0 >> 16) & 0xff) + (((c1 >> 16) & 0xff) - ((c0 >> 16) & 0xff)) * k;
        const gC = ((c0 >> 8) & 0xff) + (((c1 >> 8) & 0xff) - ((c0 >> 8) & 0xff)) * k;
        const b = (c0 & 0xff) + ((c1 & 0xff) - (c0 & 0xff)) * k;
        return (Math.round(r) << 16) | (Math.round(gC) << 8) | Math.round(b);
      }
    }
    return 0;
  };
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    g.rect(0, t0 * WORLD_H, WORLD_W, (t1 - t0) * WORLD_H + 1).fill(bandLerp(t0));
  }
  return g;
};

const buildStars = (): Graphics => {
  const g = new Graphics();
  for (let i = 0; i < 120; i++) {
    g.circle(Math.random() * WORLD_W, Math.random() * 1100, 1 + Math.random() * 2).fill({
      color: 0xffffff,
      alpha: 0.4 + Math.random() * 0.6,
    });
  }
  return g;
};

const makeMover = (
  tex: Texture,
  x: number,
  y: number,
  scale: number,
  vx: number,
): Mover => {
  const s = new Sprite(tex);
  place(s, x, y, scale);
  return { sprite: s, vx, vy: 0, wrapMinX: -200, wrapMaxX: WORLD_W + 200 };
};

const addLayerStrip = (
  parent: Container,
  aliases: string[],
  y: number,
  alpha = 1,
  scaleY = 1,
  tint = 0xffffff,
): void => {
  const tileW = WORLD_W / aliases.length;
  aliases.forEach((alias, index) => {
    const sprite = new Sprite(Assets.get(alias));
    sprite.anchor.set(0, 1);
    sprite.x = index * tileW;
    sprite.y = y;
    sprite.width = tileW + 2;
    sprite.scale.y = sprite.scale.x * scaleY;
    sprite.alpha = alpha;
    sprite.tint = tint;
    parent.addChild(sprite);
  });
};

const addBackgroundStrip = (
  parent: Container,
  aliases: string[],
  y: number,
  alpha = 1,
  scaleY = 1,
  tint = 0xffffff,
): void => {
  const totalW = WORLD_W + BACKGROUND_OVERSCAN_X * 2;
  const tileW = totalW / aliases.length;
  aliases.forEach((alias, index) => {
    const sprite = new Sprite(Assets.get(alias));
    sprite.anchor.set(0, 1);
    sprite.x = -BACKGROUND_OVERSCAN_X + index * tileW;
    sprite.y = y;
    sprite.width = tileW + 18;
    sprite.scale.y = sprite.scale.x * scaleY;
    sprite.alpha = alpha;
    sprite.tint = tint;
    parent.addChild(sprite);
  });
};

const drawTerrainRibbon = (
  layer: Graphics,
  topOffset: number,
  thickness: number,
  color: number,
  alpha: number,
): void => {
  const step = 24;
  layer.moveTo(0, hillSurfaceY(0) + topOffset);
  for (let x = step; x <= WORLD_W; x += step) {
    layer.lineTo(x, hillSurfaceY(x) + topOffset);
  }
  layer.lineTo(WORLD_W, hillSurfaceY(WORLD_W) + topOffset + thickness);
  for (let x = WORLD_W - step; x >= 0; x -= step) {
    layer.lineTo(x, hillSurfaceY(x) + topOffset + thickness);
  }
  layer.closePath();
  layer.fill({ color, alpha });
};

const drawTerrainSegment = (
  layer: Graphics,
  x0: number,
  x1: number,
  topOffset: number,
  bottomOffset: number,
  color: number,
  alpha: number,
): void => {
  layer.moveTo(x0, hillSurfaceY(x0) + topOffset);
  layer.lineTo(x1, hillSurfaceY(x1) + topOffset);
  layer.lineTo(x1, hillSurfaceY(x1) + bottomOffset);
  layer.lineTo(x0, hillSurfaceY(x0) + bottomOffset);
  layer.closePath();
  layer.fill({ color, alpha });
};

const drawStripedFairway = (layer: Graphics): void => {
  const stripeWidth = 38;
  const fairwayTop = 6;
  const fairwayBottom = 96;

  drawTerrainRibbon(layer, fairwayTop, fairwayBottom - fairwayTop, 0x7fc84d, 1);
  drawTerrainRibbon(layer, fairwayTop - 5, 7, 0xd3ee80, 0.95);
  drawTerrainRibbon(layer, fairwayTop + 6, 8, 0xb9e36c, 0.54);

  for (let x = -stripeWidth; x < WORLD_W + stripeWidth; x += stripeWidth) {
    const index = Math.floor(x / stripeWidth);
    drawTerrainSegment(
      layer,
      x,
      x + stripeWidth * 0.72,
      fairwayTop + 11,
      fairwayBottom - 7,
      index % 2 === 0 ? 0xb7e36d : 0x5fae3f,
      index % 2 === 0 ? 0.72 : 0.58,
    );
  }

  drawTerrainRibbon(layer, fairwayBottom - 13, 12, 0x6fb841, 0.38);
  drawTerrainRibbon(layer, fairwayBottom - 1, 11, 0x276f3f, 0.76);
};

const buildProceduralFrontTerrain = (tint = 0xffffff): Graphics => {
  const terrain = new Graphics();
  const bottomY = GROUND_Y + 360;
  const step = 24;

  terrain.moveTo(0, hillSurfaceY(0));
  for (let x = step; x <= WORLD_W; x += step) {
    terrain.lineTo(x, hillSurfaceY(x));
  }
  terrain.lineTo(WORLD_W, bottomY);
  terrain.lineTo(0, bottomY);
  terrain.closePath();
  terrain.fill({ color: 0x5faa4a, alpha: 1 });

  drawStripedFairway(terrain);
  drawTerrainRibbon(terrain, 106, 230, 0x2d7441, 0.78);
  drawTerrainRibbon(terrain, 136, 34, 0x1f5d38, 0.4);

  terrain.tint = tint;
  return terrain;
};

const addStaticSprite = (
  parent: Container,
  alias: string,
  x: number,
  y: number,
  scale: number,
  alpha = 1,
  flip = false,
): void => {
  const sprite = new Sprite(Assets.get(alias));
  place(sprite, x, y, scale, 0.5);
  sprite.alpha = alpha;
  if (flip) sprite.scale.x = -sprite.scale.x;
  parent.addChild(sprite);
};

const buildGroundDetails = (depth: "back" | "mid" | "front"): Container => {
  const layer = new Container();
  const alpha = depth === "front" ? 0.72 : depth === "mid" ? 0.78 : 0.5;
  const yOffset = depth === "front" ? 0 : depth === "mid" ? -180 : -360;
  const scaleMul = depth === "front" ? 1 : depth === "mid" ? 0.86 : 0.72;
  const hazardY = GROUND_Y - 520 + yOffset;

  const waterLeft = new Sprite(Assets.get("waterTrap1"));
  place(waterLeft, 460 + (depth === "back" ? 620 : 0), hazardY, 0.48 * scaleMul, 0.5);
  waterLeft.alpha = alpha;
  layer.addChild(waterLeft);

  const waterRight = new Sprite(Assets.get("waterTrap3"));
  place(waterRight, 2020 + (depth === "back" ? 840 : 0), hazardY - 22, 0.5 * scaleMul, 0.5);
  waterRight.alpha = alpha;
  layer.addChild(waterRight);

  const sand = new Sprite(Assets.get("sandTrap1"));
  place(sand, 1280 + (depth === "back" ? 980 : 0), hazardY + 8, 0.52 * scaleMul, 0.5);
  sand.alpha = alpha;
  layer.addChild(sand);

  const hole = new Graphics();
  hole.ellipse(HOLE_X, HOLE_Y, 24, 9).fill({ color: 0x0b0f14, alpha: 0.95 });
  hole.ellipse(HOLE_X, HOLE_Y - 2, 16, 5).fill({ color: 0x1f2630, alpha: 0.8 });
  if (depth === "front") layer.addChild(hole);

  const bushCount = depth === "front" ? 2 : depth === "mid" ? 5 : 3;
  for (let i = 0; i < bushCount; i++) {
    const alias =
      depth === "front" ? (i % 2 === 0 ? "frontBush1" : "frontBush2") : `midBush${(i % 3) + 1}`;
    const bush = new Sprite(Assets.get(alias));
    const spread = depth === "back" ? 380 : depth === "mid" ? 260 : 520;
    place(
      bush,
      depth === "front" ? 80 + i * spread : 120 + i * spread + (i % 2) * 24,
      depth === "front"
        ? GROUND_Y - 70 - (i % 2) * 16
        : GROUND_Y - 440 + yOffset - (i % 3) * 28,
      (depth === "front" ? 0.46 : 0.42) * (1 + (i % 2) * 0.08) * scaleMul,
      0.5,
    );
    bush.alpha = alpha;
    layer.addChild(bush);
  }

  return layer;
};

const buildDistantVegetation = (): Container => {
  const layer = new Container();
  const points: Array<{ x: number; y: number; s: number; a: number; alias: string }> = [
    { x: 160, y: 2860, s: 0.24, a: 0.42, alias: "midBush1" },
    { x: 360, y: 2790, s: 0.22, a: 0.35, alias: "midBush3" },
    { x: 590, y: 2920, s: 0.25, a: 0.45, alias: "midBush2" },
    { x: 830, y: 2740, s: 0.22, a: 0.35, alias: "midBush1" },
    { x: 1080, y: 2910, s: 0.24, a: 0.4, alias: "midBush3" },
    { x: 1320, y: 2810, s: 0.22, a: 0.34, alias: "midBush2" },
    { x: 1680, y: 2880, s: 0.24, a: 0.38, alias: "midBush1" },
    { x: 2120, y: 2770, s: 0.21, a: 0.32, alias: "midBush3" },
    { x: 2580, y: 2930, s: 0.25, a: 0.4, alias: "midBush2" },
    { x: 3080, y: 2820, s: 0.22, a: 0.35, alias: "midBush1" },
    { x: 3560, y: 2890, s: 0.24, a: 0.38, alias: "midBush3" },
    { x: 4060, y: 2790, s: 0.21, a: 0.32, alias: "midBush2" },
  ];
  for (const p of points) {
    const node = new Sprite(Assets.get(p.alias));
    place(node, p.x, p.y, p.s, 0.5);
    node.alpha = p.a;
    layer.addChild(node);
  }
  return layer;
};

const addWorldSprite = (
  parent: Container,
  alias: string,
  x: number,
  y: number,
  scale: number,
  alpha = 1,
  flip = false,
): Sprite => {
  const sprite = new Sprite(Assets.get(alias));
  const visualWidth = PLANNED_HAZARD_WIDTH + scale * 0;
  place(sprite, x, y, 1, 0.5);
  setSpriteVisualWidth(sprite, visualWidth, flip);
  sprite.alpha = alpha;
  parent.addChild(sprite);
  return sprite;
};

const addPlanet = (parent: Container, x: number, y: number, radius: number, color: number): void => {
  const planet = new Graphics();
  planet.circle(0, 0, radius).fill({ color, alpha: 0.86 });
  planet.ellipse(0, 0, radius * 1.5, radius * 0.34).stroke({
    color: 0xe8f0ff,
    alpha: 0.42,
    width: 4,
  });
  planet.x = x;
  planet.y = y;
  parent.addChild(planet);
};

const addComet = (parent: Container, x: number, y: number, scale = 1): void => {
  const comet = new Graphics();
  comet.moveTo(-90 * scale, 18 * scale);
  comet.lineTo(6 * scale, -10 * scale);
  comet.lineTo(22 * scale, 6 * scale);
  comet.lineTo(-70 * scale, 36 * scale);
  comet.closePath();
  comet.fill({ color: 0x8feaff, alpha: 0.4 });
  comet.circle(24 * scale, 0, 13 * scale).fill({ color: 0xe8ffff, alpha: 0.9 });
  comet.x = x;
  comet.y = y;
  parent.addChild(comet);
};

const buildObjectLayerSystem = (): Container => {
  const layer = new Container();

  // Layer 0: ground hazards live in map layout; add the ground-only cart/mole flavor here.
  const mole = new Graphics();
  mole.ellipse(0, 0, 28, 10).fill({ color: 0x1a0e06, alpha: 0.58 });
  mole.ellipse(0, -9, 14, 12).fill({ color: 0x6b4423, alpha: 0.72 });
  mole.x = 1420;
  mole.y = hillSurfaceY(1420) + 18;
  layer.addChild(mole);

  // Layer 1: 2-3 birds plus lower clouds.
  addWorldSprite(layer, "bird", 980, OBJECT_LAYERS[1].centerY + 40, 0.18, 0.76);
  addWorldSprite(layer, "duck", 1320, OBJECT_LAYERS[1].centerY - 30, 0.2, 0.72, true);
  addWorldSprite(layer, "duck2", 1740, OBJECT_LAYERS[1].centerY + 65, 0.18, 0.68);
  addWorldSprite(layer, "cloud1", 580, OBJECT_LAYERS[1].centerY + 120, 0.45, 0.42);
  addWorldSprite(layer, "cloud2", 2280, OBJECT_LAYERS[1].centerY + 100, 0.48, 0.38);

  // Layer 2: upper clouds and helicopter below them.
  addWorldSprite(layer, "cloud5", 1080, OBJECT_LAYERS[2].centerY - 110, 0.54, 0.42);
  addWorldSprite(layer, "cloud7", 2820, OBJECT_LAYERS[2].centerY - 80, 0.5, 0.36);
  addWorldSprite(layer, "helicopter", 2080, OBJECT_LAYERS[2].centerY + 80, 0.32, 0.78, true);

  // Layer 3: high-air plane corridor.
  addWorldSprite(layer, "plane", 1640, OBJECT_LAYERS[3].centerY, 0.36, 0.78);
  addWorldSprite(layer, "plane3", 3380, OBJECT_LAYERS[3].centerY - 120, 0.34, 0.62, true);

  // Layer 4: upper atmosphere/stars/satellite pass-through.
  addWorldSprite(layer, "satellite", 980, OBJECT_LAYERS[4].centerY - 90, 0.24, 0.68);
  addWorldSprite(layer, "cloud10", 2460, OBJECT_LAYERS[4].centerY + 150, 0.42, 0.2);

  // Layer 5: space objects - planets, comet, meteors, UFO.
  addPlanet(layer, 620, OBJECT_LAYERS[5].centerY - 80, 42, 0x73d6ff);
  addPlanet(layer, 3090, OBJECT_LAYERS[5].centerY + 20, 32, 0xffb36a);
  addComet(layer, 1940, OBJECT_LAYERS[5].centerY - 160, 0.9);
  addWorldSprite(layer, "meteors", 1280, OBJECT_LAYERS[5].centerY + 130, 0.34, 0.62);
  addWorldSprite(layer, "ufo", 3740, OBJECT_LAYERS[5].centerY - 100, 0.26, 0.78, true);

  return layer;
};

export const bootstrapGame = (canvas: HTMLCanvasElement): (() => void) => {
  const app = new Application();
  const world = new Container();
  const backgroundLayer = new Container();
  const worldLayer = new Container();
  const worldObjectLayer = new Container();
  const playerLayer = new Container();
  const foregroundLayer = new Container();
  const hazardLayer = new Container();
  const fxLayer = new Container();
  const ballFxLayer = new Graphics();
  const mapLayout = getMapLayout(currentVisualWorld());
  let ambientObjectLayer: Container | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let canvasW = 0;
  let canvasH = 0;
  const movers: Mover[] = [];
  const effects: Effect[] = [];
  let ballSprite: Sprite | null = null;
  let fireBallSprite: Sprite | null = null;
  let characterSprite: Sprite | null = null;
  let multiplierLabel: Text | null = null;
  let messageLabel: Text | null = null;
  let crashFlash: Graphics | null = null;
  let goldFlash: Graphics | null = null;
  let flightStartedAt = 0;
  let lastPhase: typeof game.phase = "idle";
  let crashFlashUntil = 0;
  let goldFlashUntil = 0;
  let landedStartedAt = 0;
  let landedFromX = BALL_START_X;
  let landedFromY = BALL_START_Y;
  let landedBallX = BALL_START_X;
  let landedBallY = BALL_START_Y;
  let runStartedAt = 0;
  let characterRunFromX = CHAR_X;
  let characterRunFromY = GROUND_Y - 140;
  let currentTeeX = mapLayout.start.ballX;
  let currentTeeY = mapLayout.start.ballY;
  let currentCharacterX = mapLayout.start.characterX;
  let currentCharacterY = mapLayout.start.characterY;
  let currentPlan: RoundPlan | null = null;
  let hazardsDrawnForFlight = false;
  let nearHoleCelebrated = false;

  type PlannedHazard = {
    kind: DecorativeEvent["kind"] | CrashCause;
    node: Sprite | Text;
    startX: number;
    startY: number;
    impactX: number;
    impactY: number;
    impactAtSec: number;
    vx: number;
    baseY: number;
    amplitude: number;
    phase: number;
    impactOffsetY: number;
    primary: boolean;
    highlightUntil: number;
  };
  const plannedHazards: PlannedHazard[] = [];
  let plannedCrashTarget: PlannedHazard | null = null;
  let messageUntil = 0;
  let messageText = "";

  type CollisionAnim = {
    cause: CrashCause;
    startedAt: number;
    impactAt: number;
    endsAt: number;
    hazard: Sprite | Text | null;
    hazardFromX: number;
    hazardFromY: number;
    hazardImpactX: number;
    hazardImpactY: number;
    hazardExitVx: number;
    hazardExitVy: number;
    ballImpactX: number;
    ballImpactY: number;
    ballKnockVx: number;
    ballKnockVy: number;
    impacted: boolean;
  };
  let collision: CollisionAnim | null = null;
  const COLLISION_END_MS = 2400;
  const KNOCK_GRAVITY = 1400;

  let unsubDecorative: (() => void) | null = null;
  let unsubCrash: (() => void) | null = null;
  let unsubLanding: (() => void) | null = null;
  let unsubPreShot: (() => void) | null = null;
  let unsubRoundPlan: (() => void) | null = null;

  const renderHazardEdgeDecal = (
    x: number,
    y: number,
    type: MapFeature["type"],
    side: "left" | "right",
  ): void => {
    const decal = new Graphics();
    const direction = side === "left" ? 1 : -1;

    if (type === "water") {
      decal.ellipse(x, y + 3, 26, 7).fill({ color: 0x2f8d47, alpha: 0.82 });
      decal.ellipse(x + direction * 16, y + 7, 20, 5).fill({ color: 0x7fc84d, alpha: 0.72 });
      decal.rect(x + direction * 5, y - 18, 4, 24).fill({ color: 0x356f3e, alpha: 0.78 });
      decal.rect(x + direction * 15, y - 14, 3, 20).fill({ color: 0x4d8442, alpha: 0.72 });
    } else {
      decal.ellipse(x, y + 4, 34, 8).fill({ color: 0xd6c06a, alpha: 0.82 });
      decal.ellipse(x + direction * 18, y + 7, 24, 6).fill({ color: 0x8abf4b, alpha: 0.64 });
      decal.ellipse(x - direction * 10, y + 2, 18, 5).fill({ color: 0xf0d983, alpha: 0.72 });
    }

    worldObjectLayer.addChild(decal);
  };

  const renderMaskedHazard = (feature: MapFeature): void => {
    if (!feature.asset) return;

    const sprite = new Sprite(Assets.get(feature.asset));
    const centerX = feature.x;
    const edgePadding = feature.type === "water" ? 20 : 24;
    const leftEdgeX = feature.leftEdgeX ?? centerX - (feature.type === "water" ? 130 : 150);
    const rightEdgeX = feature.rightEdgeX ?? centerX + (feature.type === "water" ? 130 : 150);
    const startX = leftEdgeX - edgePadding;
    const endX = rightEdgeX + edgePadding;
    const width = Math.max(feature.type === "water" ? 180 : 210, endX - startX);
    const topY = feature.hazardLevelY ?? hillSurfaceY(centerX) + (feature.type === "water" ? 26 : 22);
    const bottomOffset = feature.type === "water" ? 92 : 88;
    const step = 12;

    sprite.anchor.set(0.5, 0);
    sprite.x = (startX + endX) / 2;
    sprite.y = topY - 8;
    sprite.width = width;
    sprite.height = feature.type === "water" ? 86 : 78;
    sprite.alpha = feature.alpha ?? 1;

    const mask = new Graphics();
    mask.moveTo(startX, topY);
    mask.lineTo(endX, topY);
    for (let x = endX; x >= startX; x -= step) {
      mask.lineTo(x, Math.max(topY + 10, hillSurfaceY(x) + bottomOffset));
    }
    mask.closePath();
    mask.fill(0xffffff);

    sprite.mask = mask;
    worldObjectLayer.addChild(sprite);
    worldObjectLayer.addChild(mask);
    renderHazardEdgeDecal(leftEdgeX, topY, feature.type, "left");
    renderHazardEdgeDecal(rightEdgeX, topY, feature.type, "right");
  };

  const renderMapFeature = (feature: MapFeature): void => {
    if (feature.type === "hole") {
      const hole = new Graphics();
      hole.ellipse(feature.x, feature.y, 24 * feature.scale, 9 * feature.scale).fill({
        color: 0x0b0f14,
        alpha: feature.alpha ?? 0.95,
      });
      hole.ellipse(feature.x, feature.y - 2 * feature.scale, 16 * feature.scale, 5 * feature.scale).fill({
        color: 0x1f2630,
        alpha: Math.min(0.8, feature.alpha ?? 0.8),
      });
      worldObjectLayer.addChild(hole);
      const flag = new Sprite(Assets.get("holeFlag"));
      place(flag, feature.x + 34, feature.y - 70, 0.42, 0.5);
      worldObjectLayer.addChild(flag);
      return;
    }

    if (!feature.asset) return;
    if (feature.type === "water" || feature.type === "sand") {
      renderMaskedHazard(feature);
      return;
    }

    const sprite = new Sprite(Assets.get(feature.asset));
    place(sprite, feature.x, feature.y, feature.scale, 0.5);
    sprite.alpha = feature.alpha ?? 1;
    if (feature.flip) sprite.scale.x = -sprite.scale.x;
    worldObjectLayer.addChild(sprite);
  };

  const renderMapLayout = (layout: MapLayout): void => {
    for (const feature of layout.features) renderMapFeature(feature);
  };

  const computeCameraT = (mult: number): number =>
    Math.min(1, Math.log(Math.max(1, mult)) / Math.log(10));

  const computeScale = (t: number): number => {
    const aspect = canvasW / canvasH;
    const groundView = aspect > 1 ? 2200 : 2800;
    const zoomIn = canvasH / groundView;
    const zoomOut = canvasH / 3600;
    return Math.max(canvasH / WORLD_H, zoomIn - t * (zoomIn - zoomOut));
  };

  const isCurrentPlanZeroCrash = (): boolean =>
    currentPlan?.landingZone === "water" ||
    currentPlan?.crashCause === "timeout" ||
    currentPlan?.crashCause === "fakeBoost";

  const primaryImpactProgress = (): number => {
    if (!currentPlan || isCurrentPlanZeroCrash()) return 1;
    return 0.68;
  };

  const impactCauseForPlan = (plan: RoundPlan | null): CrashCause | null =>
    plan?.crashCause ?? (plan?.landingZone === "cart" ? "cart" : null);

  const updateCamera = (): void => {
    const t = computeCameraT(game.multiplier);
    const scale = computeScale(t);
    const followFlight = game.phase === "flight" && fireBallSprite !== null;
    const followRun = game.phase === "runToBall" && characterSprite !== null;
    const followLanded = game.phase === "landed" && !game.isJackpot;
    const followRest =
      game.phase === "idle" ||
      game.phase === "cashOut" ||
      game.phase === "crashed" ||
      game.phase === "lose";
    const shouldFollow = followFlight || followRun || followLanded || followRest;
    const targetX = followFlight
      ? fireBallSprite!.x
      : followRun
        ? characterSprite!.x
        : followLanded
          ? currentTeeX
          : followRest
            ? currentTeeX
            : BALL_START_X;
    const targetY = followFlight
      ? fireBallSprite!.y
      : followRun
        ? characterSprite!.y
        : followLanded
          ? currentTeeY
          : followRest
            ? currentTeeY
            : BALL_START_Y;
    const groundCamY = canvasH - WORLD_H * scale;
    const centeredCamY = canvasH / 2 - targetY * scale;
    world.scale.set(scale);
    const cameraFocusX = shouldFollow ? canvasW * 0.36 : canvasW * 0.5;
    const rawX = cameraFocusX - targetX * scale;
    const minX = canvasW - WORLD_W * scale;
    world.x =
      WORLD_W * scale <= canvasW ? (canvasW - WORLD_W * scale) / 2 : Math.max(minX, Math.min(0, rawX));

    const rawY = shouldFollow ? Math.max(groundCamY, centeredCamY) : groundCamY;
    const minY = canvasH - WORLD_H * scale;
    world.y =
      WORLD_H * scale <= canvasH ? (canvasH - WORLD_H * scale) / 2 : Math.max(minY, Math.min(0, rawY));

    const parallaxX = -world.x / Math.max(0.0001, scale);
    backgroundLayer.x = parallaxX * 0.8;
  };

  const trajectoryPoint = (
    progress: number,
    outcome: RoundPlan["outcome"] = "crash",
  ): { x: number; y: number } => {
    const arcT = Math.min(1, Math.max(0, progress));
    const desiredZoneType = outcome === "holeInOne" ? "hole" : currentPlan?.landingZone;
    const zoneType = desiredZoneType === "cart" ? "fairway" : desiredZoneType;
    const nextLandingZone = (minX: number): { x: number; y: number } => {
      const searchMinX = Math.min(minX, PLAY_END_X - 240);
      const nextZone = mapLayout.landingZones
        .filter((zone) => zone.type === zoneType && zone.x > searchMinX && zone.x <= PLAY_END_X)
        .sort((a, b) => a.x - b.x)[0];
      if (nextZone) return { x: nextZone.x, y: nextZone.y };
      const nearestZone = mapLayout.landingZones
        .filter((zone) => zone.type === zoneType && zone.x > currentTeeX + 80 && zone.x <= PLAY_END_X)
        .sort((a, b) => Math.abs(a.x - searchMinX) - Math.abs(b.x - searchMinX))[0];
      if (nearestZone) return { x: nearestZone.x, y: nearestZone.y };
      const candidateX = searchMinX + 680;
      const x = Math.min(PLAY_END_X, candidateX);
      return { x, y: x >= PLAY_END_X - 24 ? HOLE_Y : hillSurfaceY(x) };
    };
    const cause = impactCauseForPlan(currentPlan);
    const crashLayer = cause ? CRASH_LAYER[cause] : null;
    const plannedTarget =
      outcome === "crash" && cause && plannedCrashTarget?.kind === cause ? plannedCrashTarget : null;
    const initialLanding = nextLandingZone(currentTeeX + 220);
    const landingX = initialLanding.x;
    const landingY = initialLanding.y;
    const isSafeImpact =
      outcome === "crash" && plannedTarget !== null && currentPlan !== null && !isCurrentPlanZeroCrash();
    const impactProgress = primaryImpactProgress();
    const lerpQuadratic = (
      t: number,
      from: { x: number; y: number },
      control: { x: number; y: number },
      to: { x: number; y: number },
    ): { x: number; y: number } => {
      const inv = 1 - t;
      return {
        x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
        y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y,
      };
    };

    if (isSafeImpact) {
      const impact = { x: plannedTarget.impactX, y: plannedTarget.impactY };
      const safeLanding = nextLandingZone(impact.x + (cause === "cart" ? 360 : 180));
      if (arcT <= impactProgress) {
        const localT = Math.min(1, arcT / impactProgress);
        const layerBoost = crashLayer !== null && crashLayer > 0 ? 280 + crashLayer * 70 : 260;
        return lerpQuadratic(
          localT,
          { x: currentTeeX, y: currentTeeY },
          { x: (currentTeeX + impact.x) / 2, y: Math.min(currentTeeY, impact.y) - layerBoost },
          impact,
        );
      }
      const localT = Math.min(1, (arcT - impactProgress) / Math.max(0.01, 1 - impactProgress));
      return lerpQuadratic(
        localT,
        impact,
        {
          x: (impact.x + safeLanding.x) / 2,
          y: Math.min(impact.y, safeLanding.y) - (cause === "cart" ? 320 : 160),
        },
        safeLanding,
      );
    }

    const targetX = Math.min(PLAY_END_X, plannedTarget?.impactX ?? landingX);
    const targetY =
      plannedTarget?.impactY ??
      (outcome === "crash" && crashLayer !== null && crashLayer > 0
        ? OBJECT_LAYERS[crashLayer].centerY
        : landingY);
    const arcHeight =
      crashLayer === 5
        ? 760
        : crashLayer === 3
          ? 560
          : crashLayer === 2
            ? 460
            : crashLayer === 1
              ? 360
          : cause === "cart"
            ? 280
            : Math.max(360, currentTeeY - BALL_APEX_Y);
    const control = {
      x: (currentTeeX + targetX) / 2,
      y: Math.min(currentTeeY, targetY) - arcHeight,
    };
    return lerpQuadratic(arcT, { x: currentTeeX, y: currentTeeY }, control, { x: targetX, y: targetY });
  };

  const clearPlannedHazards = (): void => {
    hazardLayer.removeChildren().forEach((node) => node.destroy({ children: true }));
    plannedHazards.length = 0;
    plannedCrashTarget = null;
  };

  const hazardAliasFor = (kind: DecorativeEvent["kind"] | CrashCause): string | null => {
    switch (kind) {
      case "bird":
        return "bird";
      case "plane":
        return "plane2";
      case "helicopter":
        return "helicopter2";
      case "cart":
        return "golfCar";
      case "timeout":
      case "fakeBoost":
        return "ufo";
      default:
        return null;
    }
  };

  const layerForKind = (kind: DecorativeEvent["kind"] | CrashCause): ObjectLayerId =>
    kind === "cart"
      ? 0
      : kind === "bird" || kind === "wind"
        ? 1
        : kind === "helicopter"
          ? 2
          : kind === "plane"
            ? 3
            : kind === "timeout" || kind === "fakeBoost"
              ? 5
              : 4;

  const plannedHazardImpactPosition = (
    kind: DecorativeEvent["kind"] | CrashCause,
    atSec: number,
  ): { x: number; y: number } => {
    const layerId = layerForKind(kind);
    const x = Math.min(PLAY_END_X, currentTeeX + Math.max(420, BALL_SPEED_X * atSec));
    const y = layerId === 0 ? hillSurfaceY(x) : OBJECT_LAYERS[layerId].centerY;
    return { x, y };
  };

  const hazardVelocity = (kind: DecorativeEvent["kind"] | CrashCause, primary: boolean): number => {
    const speedMul = primary ? 0.55 : 1;
    switch (kind) {
      case "cart":
        return 70 * speedMul;
      case "bird":
        return -90 * speedMul;
      case "helicopter":
        return -55 * speedMul;
      case "plane":
        return -120 * speedMul;
      case "timeout":
      case "fakeBoost":
        return -35 * speedMul;
      case "wind":
        return -45 * speedMul;
      default:
        return 0;
    }
  };

  const registerPlannedHazard = (
    kind: DecorativeEvent["kind"] | CrashCause,
    node: Sprite | Text,
    primary: boolean,
    impactOffsetY: number,
    impact: { x: number; y: number },
    impactAtSec: number,
  ): PlannedHazard => {
    const vx = hazardVelocity(kind, primary);
    const startX = impact.x - vx * impactAtSec;
    const startY =
      kind === "cart"
        ? hillSurfaceY(startX) - impactOffsetY
        : impact.y - impactOffsetY;
    node.x = startX;
    node.y = startY;
    const planned: PlannedHazard = {
      kind,
      node,
      startX,
      startY,
      impactX: impact.x,
      impactY: impact.y,
      impactAtSec,
      vx,
      baseY: startY,
      amplitude: kind === "cart" || primary ? 0 : 18,
      phase: Math.random() * Math.PI * 2,
      impactOffsetY,
      primary,
      highlightUntil: 0,
    };
    plannedHazards.push(planned);
    return planned;
  };

  const addPlannedHazard = (
    kind: DecorativeEvent["kind"] | CrashCause,
    impact: { x: number; y: number },
    impactAtSec: number,
    primary = false,
  ): PlannedHazard | null => {
    if (kind === "wind") {
      const label = new Text({
        text: "GUST",
        style: {
          fontFamily: "system-ui",
          fontSize: primary ? 72 : 48,
          fontWeight: "900",
          fill: 0xffffff,
          stroke: { color: 0x336699, width: 5 },
        },
      });
      label.anchor.set(0.5);
      label.x = impact.x;
      label.y = impact.y - 80;
      label.alpha = primary ? 0.95 : 0.55;
      hazardLayer.addChild(label);
      return registerPlannedHazard(kind, label, primary, 80, impact, impactAtSec);
    }

    const alias = hazardAliasFor(kind);
    if (!alias) return null;
    const sprite = new Sprite(Assets.get(alias));
    const impactOffsetY = kind === "cart" ? 20 : kind === "timeout" || kind === "fakeBoost" ? 0 : 36;
    place(sprite, impact.x, impact.y - impactOffsetY, 1, 0.5);
    setSpriteVisualWidth(sprite, PLANNED_HAZARD_WIDTH, kind === "plane" || kind === "helicopter");
    sprite.alpha = primary ? 0.95 : 0.62;
    hazardLayer.addChild(sprite);
    return registerPlannedHazard(kind, sprite, primary, impactOffsetY, impact, impactAtSec);
  };

  const drawPlannedHazards = (plan: RoundPlan, force = false): void => {
    if (!force && (game.phase === "flight" || game.phase === "runToBall")) return;
    clearPlannedHazards();
    currentPlan = plan;
    hazardsDrawnForFlight = game.phase === "flight";
    plan.decorativeEvents.forEach((event) => {
      addPlannedHazard(
        event.kind,
        plannedHazardImpactPosition(event.kind, event.atSec),
        event.atSec,
        false,
      );
    });
    const impactCause = impactCauseForPlan(plan);
    if (impactCause) {
      const impactAtSec = isCurrentPlanZeroCrash() ? plan.crashAtSec : plan.crashAtSec * primaryImpactProgress();
      plannedCrashTarget = addPlannedHazard(
        impactCause,
        plannedHazardImpactPosition(impactCause, impactAtSec),
        impactAtSec,
        true,
      );
    }
  };

  const updatePlannedHazards = (now: number): void => {
    const flightElapsed =
      game.phase === "flight" || game.phase === "crashed"
        ? Math.max(0, (now - flightStartedAt) / 1000)
        : 0;
    for (const hazard of plannedHazards) {
      hazard.node.x = hazard.startX + hazard.vx * flightElapsed;

      if (hazard.kind === "cart") {
        hazard.node.y = hillSurfaceY(hazard.node.x) - hazard.impactOffsetY;
      } else {
        hazard.node.y =
          hazard.baseY +
          Math.sin(now / 620 + hazard.phase) * hazard.amplitude;
      }

      hazard.node.alpha =
        now < hazard.highlightUntil
          ? 1
          : hazard.primary
            ? 0.95
            : 0.62;
    }
  };

  const updateAmbientDecor = (dt: number, now: number): void => {
    if (!ambientObjectLayer) return;
    const active = game.phase === "flight" || game.phase === "crashed";
    for (const child of ambientObjectLayer.children) {
      const layerId =
        child.y < OBJECT_LAYERS[5].centerY + 260
          ? 5
          : child.y < OBJECT_LAYERS[4].centerY + 260
            ? 4
            : child.y < OBJECT_LAYERS[3].centerY + 260
              ? 3
              : child.y < OBJECT_LAYERS[2].centerY + 260
                ? 2
                : child.y < OBJECT_LAYERS[1].centerY + 260
                  ? 1
                  : 0;
      const drift = active ? [35, -55, -70, -95, -45, -60][layerId]! : 0;
      child.x += drift * dt;
      if (child.x < currentTeeX - 900) child.x += 3600;
      if (child.x > currentTeeX + 3000) child.x -= 3600;
      if (layerId > 0) child.y += Math.sin(now / 900 + child.x * 0.01) * 4 * dt;
    }
  };

  const updateBall = (now: number): void => {
    if (!ballSprite || !fireBallSprite) return;
    const phase = game.phase;
    if (phase === "flight" && lastPhase !== "flight") {
      flightStartedAt = now;
      collision = null;
      nearHoleCelebrated = false;
      if (currentPlan && !hazardsDrawnForFlight) drawPlannedHazards(currentPlan, true);
    }
    if (phase === "runToBall" && lastPhase !== "runToBall") {
      runStartedAt = now;
      const landingPoint = trajectoryPoint(1, game.isJackpot ? "holeInOne" : "crash");
      landedBallX = landingPoint.x;
      landedBallY = landingPoint.y;
      fireBallSprite.x = landedBallX;
      fireBallSprite.y = landedBallY;
      currentTeeX = landedBallX;
      currentTeeY = hillSurfaceY(landedBallX);
      currentCharacterX = Math.max(mapLayout.start.characterX, landedBallX - 95);
      currentCharacterY = hillSurfaceY(currentCharacterX) - 72;
      if (!nearHoleCelebrated && Math.abs(landedBallX - HOLE_X) <= NEAR_HOLE_DISTANCE) {
        nearHoleCelebrated = true;
        spawnNearHoleLanding(now);
      }
      if (currentPlan?.landingZone === "sand") triggerSandDust(landedBallX, landedBallY, now);
      if (characterSprite) {
        characterRunFromX = characterSprite.x;
        characterRunFromY = characterSprite.y;
      }
    }
    if (phase === "crashed" && lastPhase !== "crashed") crashFlashUntil = now + 700;
    if (phase === "landed" && lastPhase !== "landed") {
      goldFlashUntil = now + 900;
      landedStartedAt = now;
      landedFromX = fireBallSprite.x;
      landedFromY = fireBallSprite.y;
    }
    lastPhase = phase;

    if (phase === "flight") {
      ballSprite.visible = false;
      fireBallSprite.visible = true;
      if (collision && now >= collision.impactAt && isCurrentPlanZeroCrash()) {
        const dt = (now - collision.impactAt) / 1000;
        fireBallSprite.x = collision.ballImpactX + collision.ballKnockVx * dt;
        fireBallSprite.y =
          collision.ballImpactY + collision.ballKnockVy * dt + 0.5 * KNOCK_GRAVITY * dt * dt;
        fireBallSprite.rotation += 0.3;
        return;
      }
      const elapsed = (now - flightStartedAt) / 1000;
      const duration = Math.max(0.1, currentPlan?.crashAtSec ?? 1);
      // Multiplier-driven progress so ball accelerates with X. A small linear
      // baseline keeps it from looking frozen at low X.
      const linearT = Math.min(1, Math.max(0, elapsed / duration));
      const multSpan = Math.max(0.01, game.crashAt - 1);
      const multT = Math.min(1, Math.max(0, (game.multiplier - 1) / multSpan));
      const progress = Math.max(linearT * 0.18, multT);
      const wobble = Math.sin(elapsed * 5) * 8 * (1 - progress);
      const pos = trajectoryPoint(progress, game.isJackpot ? "holeInOne" : "crash");
      fireBallSprite.x = pos.x + wobble;
      fireBallSprite.y = pos.y;
      const speedFactor = 1 + Math.log(Math.max(1, game.multiplier)) * 0.55;
      fireBallSprite.rotation += 0.14 * speedFactor;
      return;
    }

    if (phase === "runToBall") {
      ballSprite.visible = false;
      fireBallSprite.visible = true;
      fireBallSprite.x = landedBallX;
      fireBallSprite.y = landedBallY;
      fireBallSprite.rotation += 0.04;
      return;
    }

    if (phase === "landed") {
      if (!game.isJackpot) {
        ballSprite.visible = false;
        fireBallSprite.visible = true;
        fireBallSprite.x = landedBallX;
        fireBallSprite.y = landedBallY;
        fireBallSprite.alpha = 1;
        return;
      }
      // Ball lands into the hole area, then briefly sinks.
      ballSprite.visible = false;
      fireBallSprite.visible = true;
      const arrival = Math.min(1, (now - landedStartedAt) / 700);
      const sink = Math.max(0, (now - landedStartedAt - 700) / 250);
      fireBallSprite.x = landedFromX + (HOLE_X - landedFromX) * arrival;
      fireBallSprite.y =
        landedFromY + (HOLE_Y - landedFromY) * arrival - Math.sin(arrival * Math.PI) * 68 + sink * 8;
      fireBallSprite.alpha = 1 - Math.min(0.45, sink * 0.45);
      fireBallSprite.rotation += 0.1;
      return;
    }

    if (phase === "crashed") {
      fireBallSprite.visible = true;
      ballSprite.visible = false;
      if (collision && collision.impacted) {
        // Continue knockback trajectory from impact moment.
        const dt = (now - collision.impactAt) / 1000;
        fireBallSprite.x = collision.ballImpactX + collision.ballKnockVx * dt;
        fireBallSprite.y =
          collision.ballImpactY + collision.ballKnockVy * dt + 0.5 * KNOCK_GRAVITY * dt * dt;
        fireBallSprite.rotation += 0.18;
      } else {
        fireBallSprite.y += Math.min(8, (now - (crashFlashUntil - 700)) / 60);
        fireBallSprite.rotation += 0.08;
      }
      return;
    }

    if (collision) {
      // Round reset before collision finished — drop the lingering animation.
      if (collision.hazard?.parent) {
        collision.hazard.parent.removeChild(collision.hazard);
        collision.hazard.destroy();
      }
      collision = null;
    }

    fireBallSprite.visible = false;
    fireBallSprite.alpha = 1;
    ballSprite.visible = true;
    ballSprite.x = currentTeeX;
    ballSprite.y = currentTeeY;
  };

  const updateCharacter = (now: number): void => {
    if (!characterSprite) return;
    characterSprite.visible = true;
    characterSprite.alpha = 1;
    if (game.phase === "runToBall") {
      const t = Math.min(1, (now - runStartedAt) / 2000);
      const eased = 1 - Math.pow(1 - t, 3);
      const targetX = Math.max(mapLayout.start.characterX, landedBallX - 95);
      characterSprite.x = characterRunFromX + (targetX - characterRunFromX) * eased;
      characterSprite.y = hillSurfaceY(characterSprite.x) - 72 - Math.sin(t * Math.PI * 6) * 10;
      return;
    }
    if (
      game.phase === "idle" ||
      game.phase === "landed" ||
      game.phase === "flight" ||
      game.phase === "cashOut" ||
      game.phase === "crashed" ||
      game.phase === "lose"
    ) {
      characterSprite.x = currentCharacterX;
      characterSprite.y = currentCharacterY;
    }
  };

  const ballPos = (): { x: number; y: number } => {
    if (
      (game.phase === "flight" || game.phase === "landed" || game.phase === "crashed") &&
      fireBallSprite
    ) {
      return { x: fireBallSprite.x, y: fireBallSprite.y };
    }
    return { x: BALL_START_X, y: BALL_START_Y };
  };

  const canSpawnEventAtBall = (event: DecorativeEvent): boolean => {
    const pos = ballPos();
    const layerY = OBJECT_LAYERS[layerForKind(event.kind)].centerY;
    const tolerance = event.kind === "cart" ? 260 : 360;
    switch (event.kind) {
      case "bird":
      case "wind":
      case "helicopter":
      case "plane":
        return Math.abs(pos.y - layerY) <= tolerance;
      case "cart":
        return pos.y > GROUND_Y - 420;
      default:
        return true;
    }
  };

  const spawnEffect = (event: DecorativeEvent, now: number): void => {
    if (!canSpawnEventAtBall(event)) return;
    const planned =
      plannedHazards.find((hazard) => hazard.kind === event.kind && !hazard.primary) ??
      plannedHazards.find((hazard) => hazard.kind === event.kind);
    if (!planned) return;
    planned.highlightUntil = now + 700;
    const pos = { x: planned.node.x, y: planned.node.y + planned.impactOffsetY };
    const ping = new Graphics();
    ping.circle(0, 0, 28).stroke({ color: 0xffffff, width: 4, alpha: 0.55 });
    ping.x = pos.x;
    ping.y = pos.y;
    fxLayer.addChild(ping);
    effects.push({ node: ping, vx: 0, vy: -25, expiresAt: now + 650 });
  };

  const addImpactRing = (x: number, y: number, now: number, color = 0xfff0a0): void => {
    const impact = new Graphics();
    impact.circle(0, 0, 46).stroke({ color, width: 8, alpha: 0.95 });
    impact.circle(0, 0, 22).fill({ color: 0xff6040, alpha: 0.45 });
    impact.x = x;
    impact.y = y;
    fxLayer.addChild(impact);
    effects.push({ node: impact, vx: 0, vy: -40, expiresAt: now + 900 });
  };

  const triggerCartHit = (x: number, y: number, now: number): void => {
    addImpactRing(x, y, now, 0xffd36a);
    const label = new Text({
      text: "!",
      style: {
        fontFamily: "system-ui",
        fontSize: 96,
        fontWeight: "900",
        fill: 0xfff3a0,
        stroke: { color: 0x743500, width: 7 },
      },
    });
    label.anchor.set(0.5);
    label.x = x + 36;
    label.y = y - 130;
    fxLayer.addChild(label);
    effects.push({ node: label, vx: 0, vy: -70, expiresAt: now + 1000 });

    for (let i = 0; i < 4; i++) {
      const smoke = new Graphics();
      smoke.circle(0, 0, 18 + i * 5).fill({ color: 0x5f6670, alpha: 0.28 });
      smoke.x = x - 20 + i * 18;
      smoke.y = y - 28 - i * 6;
      fxLayer.addChild(smoke);
      effects.push({ node: smoke, vx: -40 + i * 16, vy: -60 - i * 12, expiresAt: now + 1200 });
    }
  };

  const triggerWaterSplash = (x: number, y: number, now: number): void => {
    const splash = new Graphics();
    splash.ellipse(0, 0, 74, 18).fill({ color: 0x6ddcff, alpha: 0.65 });
    splash.ellipse(0, -8, 42, 11).fill({ color: 0xd8fbff, alpha: 0.55 });
    splash.x = x;
    splash.y = y + 14;
    fxLayer.addChild(splash);
    effects.push({ node: splash, vx: 0, vy: -20, expiresAt: now + 1100 });
  };

  const triggerSandDust = (x: number, y: number, now: number): void => {
    const dust = new Graphics();
    dust.ellipse(0, 0, 78, 20).fill({ color: 0xe8cf7a, alpha: 0.58 });
    dust.ellipse(-28, -10, 34, 12).fill({ color: 0xffe9a6, alpha: 0.45 });
    dust.ellipse(30, -8, 38, 13).fill({ color: 0xc89d48, alpha: 0.34 });
    dust.x = x;
    dust.y = y + 12;
    fxLayer.addChild(dust);
    effects.push({ node: dust, vx: 0, vy: -26, expiresAt: now + 1000 });
  };

  const spawnCrashCause = (cause: CrashCause, now: number): void => {
    const fallbackTarget = trajectoryPoint(1, currentPlan?.outcome ?? "crash");
    const ballX = plannedCrashTarget?.impactX ?? fallbackTarget.x;
    const ballY = plannedCrashTarget?.impactY ?? fallbackTarget.y;
    if (fireBallSprite) {
      fireBallSprite.x = ballX;
      fireBallSprite.y = ballY;
    }
    const sideMul = ballX > currentTeeX ? 1 : -1;
    const ballKnockVx =
      cause === "timeout" || cause === "fakeBoost"
        ? (Math.random() - 0.5) * 100
        : sideMul * (cause === "cart" ? 380 : 260);
    const ballKnockVy = cause === "cart" ? -200 : cause === "timeout" || cause === "fakeBoost" ? 260 : 320;

    collision = {
      cause,
      startedAt: now,
      impactAt: now,
      endsAt: now + COLLISION_END_MS,
      hazard: null,
      hazardFromX: ballX,
      hazardFromY: ballY,
      hazardImpactX: ballX,
      hazardImpactY: ballY,
      hazardExitVx: 0,
      hazardExitVy: 0,
      ballImpactX: ballX,
      ballImpactY: ballY,
      ballKnockVx,
      ballKnockVy,
      impacted: false,
    };

    messageText = CRASH_CAUSE_LABEL[cause];
    messageUntil = now + 1400;
  };

  const onCollisionImpact = (now: number): void => {
    if (!collision) return;
    const { cause, ballImpactX: x, ballImpactY: y } = collision;
    if (cause === "cart") {
      triggerCartHit(x, y, now);
      messageText = "CART BOUNCE!";
      messageUntil = now + 1400;
    } else if (cause === "wind") {
      addImpactRing(x, y, now, 0x9fd6ff);
    } else if (cause === "timeout") {
      // No ring — ball just falls quietly.
    } else if (cause === "fakeBoost") {
      const burn = new Graphics();
      burn.circle(0, 0, 54).fill({ color: 0xff7a00, alpha: 0.38 });
      burn.circle(0, 0, 28).fill({ color: 0xfff0a0, alpha: 0.46 });
      burn.x = x;
      burn.y = y;
      fxLayer.addChild(burn);
      effects.push({ node: burn, vx: 0, vy: -35, expiresAt: now + 1000 });
    } else {
      addImpactRing(x, y, now, 0xfff0a0);
    }
    if (isCurrentPlanZeroCrash()) {
      if (currentPlan?.landingZone === "water") triggerWaterSplash(x, y + 40, now);
      else if (currentPlan?.landingZone === "sand") triggerSandDust(x, y + 40, now);
    }
    crashFlashUntil = Math.max(crashFlashUntil, now + 360);
  };

  const updateCollision = (now: number): void => {
    if (!collision) return;

    // Advance hazard sprite/label.
    if (collision.hazard) {
      if (now < collision.impactAt) {
        const t =
          (now - collision.startedAt) /
          Math.max(1, collision.impactAt - collision.startedAt);
        const eased = Math.min(1, Math.max(0, t));
        collision.hazard.x =
          collision.hazardFromX +
          (collision.hazardImpactX - collision.hazardFromX) * eased;
        collision.hazard.y =
          collision.hazardFromY +
          (collision.hazardImpactY - collision.hazardFromY) * eased;
      } else {
        const exitT = (now - collision.impactAt) / 1000;
        collision.hazard.x = collision.hazardImpactX + collision.hazardExitVx * exitT;
        collision.hazard.y = collision.hazardImpactY + collision.hazardExitVy * exitT;
        collision.hazard.alpha = Math.max(0, 1 - exitT * 1.4);
      }
    }

    if (!collision.impacted && now >= collision.impactAt) {
      collision.impacted = true;
      onCollisionImpact(now);
    }

    if (now >= collision.endsAt) {
      if (collision.hazard?.parent) {
        collision.hazard.parent.removeChild(collision.hazard);
        collision.hazard.destroy();
      }
      collision = null;
    }
  };

  const updateBallFx = (now: number): void => {
    ballFxLayer.clear();
    if (!fireBallSprite?.visible || game.phase !== "flight") return;
    const cause = currentPlan?.crashCause;
    ballFxLayer.x = fireBallSprite.x;
    ballFxLayer.y = fireBallSprite.y;

    if (cause === "fakeBoost") {
      const pulse = 0.5 + Math.sin(now / 80) * 0.16;
      ballFxLayer.circle(-18, 6, 24).fill({ color: 0xff5a00, alpha: 0.42 + pulse * 0.2 });
      ballFxLayer.circle(-8, -4, 16).fill({ color: 0xffe066, alpha: 0.32 });
      ballFxLayer.moveTo(-38, 14).lineTo(-72, 28).stroke({ color: 0xff7a00, width: 8, alpha: 0.5 });
      return;
    }

    if (cause === "wind") {
      for (let i = 0; i < 3; i++) {
        const y = -18 + i * 18 + Math.sin(now / 180 + i) * 4;
        ballFxLayer.moveTo(-64, y).lineTo(-22, y - 4).stroke({ color: 0xdff7ff, width: 5, alpha: 0.55 });
      }
      return;
    }

    ballFxLayer.circle(0, 0, 18).stroke({ color: 0xffffff, width: 3, alpha: 0.22 });
  };

  const spawnNearHoleLanding = (now: number): void => {
    messageText = "NEAR THE HOLE!";
    messageUntil = now + 1600;
    const ring = new Graphics();
    ring.circle(0, 0, 46).stroke({ color: 0xffffff, width: 5, alpha: 0.75 });
    ring.circle(0, 0, 72).stroke({ color: 0x88ff88, width: 4, alpha: 0.4 });
    ring.x = HOLE_X;
    ring.y = HOLE_Y;
    fxLayer.addChild(ring);
    effects.push({ node: ring, vx: 0, vy: -10, expiresAt: now + 1200 });
  };

  const spawnHoleLanding = (now: number): void => {
    messageText = "HOLE IN ONE!";
    messageUntil = now + 2200;
    // sparkle ring
    const ring = new Graphics();
    ring.circle(0, 0, 60).stroke({ color: 0xffd700, width: 8, alpha: 0.9 });
    ring.x = FLAG_X;
    ring.y = FLAG_Y;
    fxLayer.addChild(ring);
    effects.push({ node: ring, vx: 0, vy: 0, expiresAt: now + 1400 });
  };

  const spawnPreShotFail = (kind: PreShotFail, now: number): void => {
    messageText = PRE_SHOT_FAIL_LABEL[kind];
    messageUntil = now + 1600;

    const ballX = ballSprite?.x ?? currentTeeX;
    const ballY = ballSprite?.y ?? currentTeeY;
    const charX = characterSprite?.x ?? currentCharacterX;
    const charY = characterSprite?.y ?? currentCharacterY;

    if (kind === "mole") {
      const hole = new Graphics();
      hole.ellipse(0, 0, 36, 12).fill({ color: 0x1a0e06, alpha: 0.95 });
      hole.ellipse(0, -3, 28, 8).fill({ color: 0x3a230f, alpha: 0.8 });
      hole.x = ballX;
      hole.y = ballY + 14;
      world.addChild(hole);
      effects.push({ node: hole, vx: 0, vy: 0, expiresAt: now + 1800 });

      const mole = new Graphics();
      mole.ellipse(0, 0, 22, 18).fill({ color: 0x6b4423, alpha: 1 });
      mole.ellipse(-8, -6, 4, 4).fill({ color: 0x000000, alpha: 1 });
      mole.ellipse(8, -6, 4, 4).fill({ color: 0x000000, alpha: 1 });
      mole.ellipse(0, 4, 6, 4).fill({ color: 0xffb0a0, alpha: 1 });
      mole.rect(-2, 6, 4, 8).fill({ color: 0xffffff, alpha: 1 });
      mole.x = ballX;
      mole.y = ballY + 4;
      world.addChild(mole);
      effects.push({ node: mole, vx: -60, vy: -120, expiresAt: now + 1600 });

      for (let i = 0; i < 8; i++) {
        const dirt = new Graphics();
        const r = 4 + Math.random() * 4;
        dirt.circle(0, 0, r).fill({ color: 0x5a3818, alpha: 0.85 });
        dirt.x = ballX + (Math.random() - 0.5) * 20;
        dirt.y = ballY;
        fxLayer.addChild(dirt);
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
        const speed = 180 + Math.random() * 220;
        effects.push({
          node: dirt,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          expiresAt: now + 1100,
        });
      }
      return;
    }

    if (kind === "clubBreak") {
      for (let i = 0; i < 2; i++) {
        const half = new Graphics();
        const dir = i === 0 ? -1 : 1;
        half.rect(-3, -42, 6, 42).fill({ color: 0xb0b0b8, alpha: 1 });
        if (i === 0) {
          half.rect(-12, -52, 18, 14).fill({ color: 0x303038, alpha: 1 });
        }
        half.x = charX + dir * 30;
        half.y = charY - 40;
        half.rotation = dir * 0.4;
        fxLayer.addChild(half);
        effects.push({
          node: half,
          vx: dir * 320,
          vy: -180 + Math.random() * 60,
          expiresAt: now + 1400,
        });
      }

      for (let i = 0; i < 4; i++) {
        const shard = new Graphics();
        shard.rect(0, 0, 4, 4).fill({ color: 0xe0e0e8, alpha: 0.9 });
        shard.x = charX;
        shard.y = charY - 60;
        fxLayer.addChild(shard);
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2;
        const speed = 240 + Math.random() * 200;
        effects.push({
          node: shard,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          expiresAt: now + 1000,
        });
      }
      return;
    }

    if (kind === "selfHit") {
      const orbit = new Container();
      orbit.x = charX;
      orbit.y = charY - 110;
      fxLayer.addChild(orbit);

      for (let i = 0; i < 5; i++) {
        const star = new Graphics();
        const a = (i / 5) * Math.PI * 2;
        const points = 5;
        const outer = 10;
        const inner = 4;
        for (let p = 0; p < points * 2; p++) {
          const angle = (p / (points * 2)) * Math.PI * 2 - Math.PI / 2;
          const r = p % 2 === 0 ? outer : inner;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (p === 0) star.moveTo(x, y);
          else star.lineTo(x, y);
        }
        star.closePath();
        star.fill({ color: 0xffd700, alpha: 1 });
        star.x = Math.cos(a) * 36;
        star.y = Math.sin(a) * 14;
        orbit.addChild(star);
      }

      effects.push({ node: orbit, vx: 0, vy: -40, expiresAt: now + 1500 });

      const bonk = new Text({
        text: "OUCH!",
        style: {
          fontFamily: "system-ui",
          fontSize: 56,
          fontWeight: "900",
          fill: 0xffe070,
          stroke: { color: 0x802000, width: 5 },
        },
      });
      bonk.anchor.set(0.5);
      bonk.x = charX + 50;
      bonk.y = charY - 130;
      fxLayer.addChild(bonk);
      effects.push({ node: bonk, vx: 60, vy: -90, expiresAt: now + 1200 });
      return;
    }
  };

  const updateEffects = (dt: number, now: number): void => {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]!;
      e.node.x += e.vx * dt;
      e.node.y += e.vy * dt;
      const lifeMs = 4000;
      const age = 1 - Math.max(0, (e.expiresAt - now) / lifeMs);
      if (e.node instanceof Text) e.node.alpha = Math.max(0, 1 - age * 1.5);
      if (e.node instanceof Graphics) e.node.alpha = Math.max(0, (e.expiresAt - now) / 1400);
      if (now >= e.expiresAt) {
        e.node.parent?.removeChild(e.node);
        e.node.destroy();
        effects.splice(i, 1);
      }
    }
  };

  const updateOverlay = (now: number): void => {
    if (multiplierLabel) {
      const phase = game.phase;
      const showMult =
        phase === "flight" ||
        phase === "cashOut" ||
        phase === "crashed" ||
        phase === "landed";
      multiplierLabel.visible = showMult;
      if (showMult) {
        multiplierLabel.text = `x${game.multiplier.toFixed(2)}`;
        multiplierLabel.style.fill =
          phase === "crashed"
            ? 0xff5555
            : phase === "cashOut"
              ? 0xffd060
              : phase === "landed"
                ? 0xffd700
                : 0xffffff;
        multiplierLabel.x = canvasW / 2;
        multiplierLabel.y = Math.max(40, canvasH * 0.08);
        multiplierLabel.style.fontSize = Math.max(36, Math.min(96, canvasH * 0.09));
      }
    }
    if (messageLabel) {
      const visible = now < messageUntil;
      messageLabel.visible = visible;
      if (visible) {
        messageLabel.text = messageText;
        messageLabel.x = canvasW / 2;
        messageLabel.y = canvasH / 2;
        messageLabel.style.fontSize = Math.max(28, Math.min(72, canvasH * 0.07));
        const remaining = (messageUntil - now) / 600;
        messageLabel.alpha = Math.min(1, remaining);
      }
    }
    if (crashFlash) {
      const visible = now < crashFlashUntil;
      crashFlash.visible = visible;
      if (visible) {
        const remaining = (crashFlashUntil - now) / 700;
        crashFlash.alpha = remaining * 0.45;
        crashFlash.clear();
        crashFlash.rect(0, 0, canvasW, canvasH).fill(0xff3030);
      }
    }
    if (goldFlash) {
      const visible = now < goldFlashUntil;
      goldFlash.visible = visible;
      if (visible) {
        const remaining = (goldFlashUntil - now) / 900;
        goldFlash.alpha = remaining * 0.5;
        goldFlash.clear();
        goldFlash.rect(0, 0, canvasW, canvasH).fill(0xffd700);
      }
    }
  };

  const animate = (ticker: Ticker): void => {
    const dt = ticker.deltaMS / 1000;
    const now = performance.now();
    for (const m of movers) {
      m.sprite.x += m.vx * dt;
      m.sprite.y += m.vy * dt;
      if (m.vx > 0 && m.sprite.x > m.wrapMaxX) m.sprite.x = m.wrapMinX;
      if (m.vx < 0 && m.sprite.x < m.wrapMinX) m.sprite.x = m.wrapMaxX;
    }
    updateAmbientDecor(dt, now);
    updatePlannedHazards(now);
    updateCollision(now);
    updateBall(now);
    updateBallFx(now);
    updateCharacter(now);
    updateEffects(dt, now);
    updateCamera();
    updateOverlay(now);
  };

  const fit = (): void => {
    const parent = canvas.parentElement;
    if (!parent) return;
    canvasW = parent.clientWidth;
    canvasH = parent.clientHeight;
    updateCamera();
  };

  const buildScene = (): void => {
    const theme = WORLD_THEMES[mapLayout.id as VisualWorld];
    world.addChild(backgroundLayer);
    world.addChild(worldLayer);
    world.addChild(worldObjectLayer);
    world.addChild(playerLayer);
    world.addChild(foregroundLayer);
    world.addChild(fxLayer);

    const sky = new Sprite(Assets.get(theme.skyAlias));
    sky.anchor.set(0, 1);
    sky.x = -BACKGROUND_OVERSCAN_X;
    sky.y = GROUND_Y;
    sky.width = WORLD_W + BACKGROUND_OVERSCAN_X * 2;
    sky.scale.y = sky.scale.x;
    backgroundLayer.addChild(sky);

    const stars = new Sprite(Assets.get("starsOverlay"));
    stars.anchor.set(0, 0);
    stars.x = -BACKGROUND_OVERSCAN_X;
    stars.y = 0;
    stars.width = WORLD_W + BACKGROUND_OVERSCAN_X * 2;
    stars.scale.y = stars.scale.x;
    stars.alpha = theme.starsAlpha;
    backgroundLayer.addChild(stars);

    addBackgroundStrip(
      backgroundLayer,
      ["back1", "back2", "back3", "back4", "back5", "back6"],
      GROUND_Y - 470,
      0.95,
      1,
      theme.terrainTint,
    );

    addBackgroundStrip(
      backgroundLayer,
      ["middle1", "middle2", "middle3", "middle4", "middle5", "middle6"],
      GROUND_Y - 210,
      0.98,
      1,
      theme.terrainTint,
    );

    worldLayer.addChild(buildProceduralFrontTerrain(theme.terrainTint));
    ambientObjectLayer = buildObjectLayerSystem();
    worldObjectLayer.addChild(ambientObjectLayer);

    renderMapLayout(mapLayout);
    worldObjectLayer.addChild(hazardLayer);

    characterSprite = new Sprite(Assets.get("sheikh"));
    place(characterSprite, mapLayout.start.characterX, mapLayout.start.characterY, 0.55, 0.5);
    playerLayer.addChild(characterSprite);

    ballSprite = new Sprite(Assets.get("ball"));
    place(ballSprite, mapLayout.start.ballX, mapLayout.start.ballY, 0.1, 0.5);
    playerLayer.addChild(ballSprite);

    fireBallSprite = new Sprite(Assets.get("ball"));
    place(fireBallSprite, mapLayout.start.ballX, mapLayout.start.ballY, 0.1, 0.5);
    fireBallSprite.visible = false;
    playerLayer.addChild(fireBallSprite);
    playerLayer.addChild(ballFxLayer);
  };

  const buildOverlay = (): void => {
    crashFlash = new Graphics();
    crashFlash.visible = false;
    app.stage.addChild(crashFlash);

    goldFlash = new Graphics();
    goldFlash.visible = false;
    app.stage.addChild(goldFlash);

    multiplierLabel = new Text({
      text: "x1.00",
      style: {
        fontFamily: "system-ui",
        fontSize: 72,
        fontWeight: "900",
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 5 },
      },
    });
    multiplierLabel.anchor.set(0.5, 0);
    multiplierLabel.visible = false;
    app.stage.addChild(multiplierLabel);

    messageLabel = new Text({
      text: "",
      style: {
        fontFamily: "system-ui",
        fontSize: 48,
        fontWeight: "900",
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 6 },
        align: "center",
      },
    });
    messageLabel.anchor.set(0.5);
    messageLabel.visible = false;
    app.stage.addChild(messageLabel);
  };

  const init = async (): Promise<void> => {
    const parent = canvas.parentElement;
    if (!parent) return;

    await app.init({
      canvas,
      resizeTo: parent,
      backgroundColor: 0x0b1230,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    await Assets.load(MANIFEST);

    buildScene();
    app.stage.addChild(world);
    buildOverlay();

    fit();
    resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(parent);

    unsubDecorative = onDecorativeEvent((ev) => spawnEffect(ev, performance.now()));
    unsubCrash = onCrashCause((cause) => spawnCrashCause(cause, performance.now()));
    unsubLanding = onHoleLanding(() => spawnHoleLanding(performance.now()));
    unsubPreShot = onPreShotFail((kind) => spawnPreShotFail(kind, performance.now()));
    unsubRoundPlan = onRoundPlanReady(drawPlannedHazards);
    void prerollNextRound();

    app.ticker.add(animate);
  };

  void init();

  return () => {
    teardownRound();
    if (unsubDecorative) unsubDecorative();
    if (unsubCrash) unsubCrash();
    if (unsubLanding) unsubLanding();
    if (unsubPreShot) unsubPreShot();
    if (unsubRoundPlan) unsubRoundPlan();
    if (resizeObserver) resizeObserver.disconnect();
    app.ticker.remove(animate);
    app.destroy(true, { children: true, texture: true });
  };
};
