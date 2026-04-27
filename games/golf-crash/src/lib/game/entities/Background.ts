import { Container } from "pixi.js";

export type WorldId = "sunny" | "golden" | "night" | "space" | "desert" | "jungle";

export class Background extends Container {
  constructor(public readonly worldId: WorldId) {
    super();
  }
}
