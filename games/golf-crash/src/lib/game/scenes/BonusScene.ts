import { Container } from "pixi.js";

export class BonusScene extends Container {
  private active = false;
  private multiplier = 1;

  constructor() {
    super();
  }

  start(baseMultiplier = 1): void {
    this.active = true;
    this.multiplier = Math.max(1, baseMultiplier);
    this.visible = true;
  }

  resolve(success: boolean): number {
    if (!this.active) return this.multiplier;
    this.active = false;
    this.visible = false;
    if (success) {
      this.multiplier = Math.round(this.multiplier * 150) / 100;
    }
    return this.multiplier;
  }

  reset(): void {
    this.active = false;
    this.multiplier = 1;
    this.visible = false;
  }
}
