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
  prerollNextRound,
  teardownRound,
} from "./round.js";
import type { CrashCause, DecorativeEvent, PreShotFail } from "./math.js";

const WORLD_W = 1530;
const WORLD_H = 4000;
const GROUND_Y = 4000;

const BALL_START_X = WORLD_W / 2;
const BALL_START_Y = GROUND_Y - 90;
const BALL_TOP_Y = 220;
const CHAR_X = BALL_START_X - 200;
const CAR_X = BALL_START_X + 200;
const FLAG_X = BALL_START_X + 420;
const FLAG_Y = GROUND_Y - 130;

const MANIFEST = [
  { alias: "back", src: "/assets/scene/back.png" },
  { alias: "middle", src: "/assets/scene/middle.png" },
  { alias: "front", src: "/assets/scene/front.png" },
  { alias: "golfCar", src: "/assets/scene/golf_car.png" },
  { alias: "sheikh", src: "/assets/scene/sheikh.png" },
  { alias: "ball", src: "/assets/scene/simple_ball.png" },
  { alias: "fireBall", src: "/assets/scene/blue_fire_ball.png" },
  { alias: "holeFlag", src: "/assets/scene/hole_flag.png" },
  { alias: "bird", src: "/assets/scene/bird.png" },
  { alias: "plane", src: "/assets/scene/plane_skins.png" },
  { alias: "helicopter", src: "/assets/scene/helicopter_skins.png" },
  { alias: "ufo", src: "/assets/scene/UFO.png" },
  { alias: "satellite", src: "/assets/scene/satellite.png" },
  { alias: "meteors", src: "/assets/scene/meteors.png" },
  { alias: "cloud1", src: "/assets/scene/cloud_1.png" },
  { alias: "cloud2", src: "/assets/scene/cloud_2.png" },
  { alias: "cloud3", src: "/assets/scene/cloud_3.png" },
  { alias: "cloud5", src: "/assets/scene/cloud_5.png" },
  { alias: "cloud7", src: "/assets/scene/cloud_7.png" },
  { alias: "cloud9", src: "/assets/scene/cloud_9.png" },
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
};

const place = (sprite: Sprite, x: number, y: number, scale: number, anchor = 0.5): void => {
  sprite.anchor.set(anchor);
  sprite.scale.set(scale);
  sprite.x = x;
  sprite.y = y;
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

export const bootstrapGame = (canvas: HTMLCanvasElement): (() => void) => {
  const app = new Application();
  const world = new Container();
  const fxLayer = new Container();
  let resizeObserver: ResizeObserver | null = null;
  let canvasW = 0;
  let canvasH = 0;
  const movers: Mover[] = [];
  const effects: Effect[] = [];
  let ballSprite: Sprite | null = null;
  let fireBallSprite: Sprite | null = null;
  let multiplierLabel: Text | null = null;
  let messageLabel: Text | null = null;
  let crashFlash: Graphics | null = null;
  let goldFlash: Graphics | null = null;
  let flightStartedAt = 0;
  let lastPhase: typeof game.phase = "idle";
  let crashFlashUntil = 0;
  let goldFlashUntil = 0;
  let messageUntil = 0;
  let messageText = "";
  let unsubDecorative: (() => void) | null = null;
  let unsubCrash: (() => void) | null = null;
  let unsubLanding: (() => void) | null = null;
  let unsubPreShot: (() => void) | null = null;

  const computeCameraT = (mult: number): number =>
    Math.min(1, Math.log(Math.max(1, mult)) / Math.log(10));

  const computeScale = (t: number): number => {
    const aspect = canvasW / canvasH;
    const groundView = aspect > 1 ? 900 : 800;
    const zoomIn = canvasH / groundView;
    const zoomOut = Math.max(canvasH / WORLD_H, canvasW / WORLD_W);
    return zoomIn - t * (zoomIn - zoomOut);
  };

  const updateCamera = (): void => {
    const t = computeCameraT(game.multiplier);
    const scale = computeScale(t);
    const followBall =
      (game.phase === "flight" || game.phase === "landed") && fireBallSprite !== null;
    const targetX = followBall ? fireBallSprite!.x : BALL_START_X;
    const targetY = followBall ? fireBallSprite!.y : BALL_START_Y;
    const groundCamY = canvasH - WORLD_H * scale;
    const centeredCamY = canvasH / 2 - targetY * scale;
    world.scale.set(scale);
    world.x = canvasW / 2 - targetX * scale;
    world.y = followBall ? Math.max(groundCamY, centeredCamY) : groundCamY;
  };

  const updateBall = (now: number): void => {
    if (!ballSprite || !fireBallSprite) return;
    const phase = game.phase;
    if (phase === "flight" && lastPhase !== "flight") flightStartedAt = now;
    if (phase === "crashed" && lastPhase !== "crashed") crashFlashUntil = now + 700;
    if (phase === "landed" && lastPhase !== "landed") goldFlashUntil = now + 900;
    lastPhase = phase;

    if (phase === "flight") {
      ballSprite.visible = false;
      fireBallSprite.visible = true;
      const t = computeCameraT(game.multiplier);
      const arcT = Math.pow(t, 0.85);
      const elapsed = (now - flightStartedAt) / 1000;
      const xDrift = Math.sin(elapsed * 0.8) * 80;
      fireBallSprite.x = BALL_START_X + xDrift + arcT * 180;
      fireBallSprite.y = BALL_START_Y - arcT * (BALL_START_Y - BALL_TOP_Y);
      fireBallSprite.rotation = -0.25 + Math.sin(elapsed * 4) * 0.05;
      return;
    }

    if (phase === "landed") {
      // Ball arcs from last flight position toward the hole flag.
      ballSprite.visible = false;
      fireBallSprite.visible = true;
      const arrival = Math.min(1, (now - (goldFlashUntil - 900)) / 600);
      const startX = fireBallSprite.x;
      const startY = fireBallSprite.y;
      fireBallSprite.x = startX + (FLAG_X - startX) * arrival;
      fireBallSprite.y = startY + (FLAG_Y - startY) * arrival - Math.sin(arrival * Math.PI) * 60;
      fireBallSprite.rotation += 0.1;
      return;
    }

    if (phase === "crashed") {
      fireBallSprite.visible = true;
      ballSprite.visible = false;
      // Ball drops post-crash for a brief sense of failure.
      fireBallSprite.y += Math.min(8, (now - (crashFlashUntil - 700)) / 60);
      fireBallSprite.rotation += 0.08;
      return;
    }

    fireBallSprite.visible = false;
    ballSprite.visible = true;
    ballSprite.x = BALL_START_X;
    ballSprite.y = BALL_START_Y;
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

  const spawnEffect = (event: DecorativeEvent, now: number): void => {
    const pos = ballPos();
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -200 : WORLD_W + 200;
    const vx = fromLeft ? 600 : -600;

    const make = (alias: string, scale: number, yOff: number): Effect => {
      const s = new Sprite(Assets.get(alias));
      place(s, startX, pos.y + yOff, scale);
      if (!fromLeft) s.scale.x = -s.scale.x;
      fxLayer.addChild(s);
      return { node: s, vx, vy: 0, expiresAt: now + 4000 };
    };

    switch (event.kind) {
      case "bird":
        effects.push(make("bird", 0.18, -40));
        break;
      case "plane":
        effects.push(make("plane", 0.32, -80));
        break;
      case "helicopter":
        effects.push(make("helicopter", 0.3, -100));
        break;
      case "cart":
        effects.push(make("ufo", 0.25, -60));
        break;
      case "wind": {
        const label = new Text({
          text: "GUST!",
          style: {
            fontFamily: "system-ui",
            fontSize: 80,
            fontWeight: "900",
            fill: 0xffffff,
            stroke: { color: 0x336699, width: 6 },
          },
        });
        label.anchor.set(0.5);
        label.x = pos.x;
        label.y = pos.y - 120;
        fxLayer.addChild(label);
        effects.push({ node: label, vx: 0, vy: -80, expiresAt: now + 1200 });
        break;
      }
    }
  };

  const spawnCrashCause = (cause: CrashCause, now: number): void => {
    const pos = ballPos();
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? pos.x - 700 : pos.x + 700;
    const vx = fromLeft ? 1100 : -1100;

    const aliasFor = (c: CrashCause): string | null => {
      switch (c) {
        case "bird":
          return "bird";
        case "plane":
          return "plane";
        case "helicopter":
          return "helicopter";
        case "cart":
          return "ufo";
        default:
          return null;
      }
    };
    const alias = aliasFor(cause);
    if (alias) {
      const s = new Sprite(Assets.get(alias));
      place(s, startX, pos.y, 0.45);
      if (!fromLeft) s.scale.x = -s.scale.x;
      fxLayer.addChild(s);
      effects.push({ node: s, vx, vy: 0, expiresAt: now + 1500 });
    }

    messageText = CRASH_CAUSE_LABEL[cause];
    messageUntil = now + 1400;
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
    updateBall(now);
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
    world.addChild(buildSky());
    world.addChild(buildStars());

    const meteor = new Sprite(Assets.get("meteors"));
    place(meteor, 1200, 250, 0.35);
    world.addChild(meteor);

    const sat = makeMover(Assets.get("satellite"), 200, 500, 0.22, 8);
    world.addChild(sat.sprite);
    movers.push(sat);

    const ufo = makeMover(Assets.get("ufo"), 1100, 1100, 0.25, -18);
    world.addChild(ufo.sprite);
    movers.push(ufo);

    const heli = makeMover(Assets.get("helicopter"), -100, 1850, 0.28, 35);
    world.addChild(heli.sprite);
    movers.push(heli);

    const plane = makeMover(Assets.get("plane"), WORLD_W + 100, 2100, 0.3, -50);
    world.addChild(plane.sprite);
    movers.push(plane);

    const plane2 = makeMover(Assets.get("plane"), -200, 2400, 0.25, 40);
    plane2.sprite.scale.x = -plane2.sprite.scale.x;
    world.addChild(plane2.sprite);
    movers.push(plane2);

    const cloudDefs: Array<[string, number, number, number, number]> = [
      ["cloud1", 200, 2700, 1.0, 6],
      ["cloud3", 900, 2850, 1.2, 4],
      ["cloud5", 1200, 2950, 0.8, 7],
      ["cloud7", 400, 3050, 1.1, 5],
      ["cloud9", 1100, 3150, 0.9, 3],
      ["cloud2", 700, 3300, 1.3, 5],
    ];
    for (const [alias, x, y, sc, vx] of cloudDefs) {
      const c = makeMover(Assets.get(alias), x, y, sc, vx);
      world.addChild(c.sprite);
      movers.push(c);
    }

    const bird = makeMover(Assets.get("bird"), -150, 3450, 0.16, 35);
    world.addChild(bird.sprite);
    movers.push(bird);

    const bird2 = makeMover(Assets.get("bird"), WORLD_W, 3520, 0.12, -25);
    bird2.sprite.scale.x = -bird2.sprite.scale.x;
    world.addChild(bird2.sprite);
    movers.push(bird2);

    const back = new Sprite(Assets.get("back"));
    back.anchor.set(0, 1);
    back.x = 0;
    back.y = GROUND_Y - 40;
    back.width = WORLD_W;
    back.scale.y = back.scale.x;
    world.addChild(back);

    const middle = new Sprite(Assets.get("middle"));
    middle.anchor.set(0, 1);
    middle.x = 0;
    middle.y = GROUND_Y - 10;
    middle.width = WORLD_W;
    middle.scale.y = middle.scale.x;
    world.addChild(middle);

    const front = new Sprite(Assets.get("front"));
    front.anchor.set(0, 1);
    front.x = 0;
    front.y = GROUND_Y;
    front.width = WORLD_W;
    front.scale.y = front.scale.x;
    world.addChild(front);

    const flag = new Sprite(Assets.get("holeFlag"));
    place(flag, FLAG_X, FLAG_Y, 0.22, 0.5);
    world.addChild(flag);

    const sheikh = new Sprite(Assets.get("sheikh"));
    place(sheikh, CHAR_X, GROUND_Y - 140, 0.55, 0.5);
    world.addChild(sheikh);

    const car = new Sprite(Assets.get("golfCar"));
    place(car, CAR_X, GROUND_Y - 160, 0.4, 0.5);
    world.addChild(car);

    ballSprite = new Sprite(Assets.get("ball"));
    place(ballSprite, BALL_START_X, BALL_START_Y, 0.1, 0.5);
    world.addChild(ballSprite);

    fireBallSprite = new Sprite(Assets.get("fireBall"));
    place(fireBallSprite, BALL_START_X, BALL_START_Y, 0.35, 0.5);
    fireBallSprite.visible = false;
    world.addChild(fireBallSprite);

    world.addChild(fxLayer);
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
    if (resizeObserver) resizeObserver.disconnect();
    app.ticker.remove(animate);
    app.destroy(true, { children: true, texture: true });
  };
};
