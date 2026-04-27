import { Container } from "pixi.js";

export type BallVariant =
  | "normal"
  | "golden"
  | "energy"
  | "fire"
  | "wet"
  | "buried";

export class Ball extends Container {
  variant: BallVariant = "normal";
  constructor() {
    super();
  }
}
