import { Container } from "pixi.js";

export type CharacterAnimation =
  | "idle"
  | "selection"
  | "swing"
  | "run"
  | "celebrate"
  | "fail"
  | "swim"
  | "sand"
  | "hitSelf";

export class Character extends Container {
  constructor(public readonly id: string) {
    super();
  }

  play(_animation: CharacterAnimation): void {}
}
