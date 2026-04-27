import { Container } from "pixi.js";
import { CHARACTERS } from "../../config/characters.js";
import { game } from "../../stores/game.svelte.js";

export class CharacterSelectScene extends Container {
  private selectedIndex = 0;

  constructor() {
    super();
    const index = CHARACTERS.findIndex((character) => character.id === game.characterId);
    this.selectedIndex = index >= 0 ? index : 0;
    this.applySelectedCharacter();
  }

  next(): void {
    this.selectedIndex = (this.selectedIndex + 1) % CHARACTERS.length;
    this.applySelectedCharacter();
  }

  prev(): void {
    this.selectedIndex = (this.selectedIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
    this.applySelectedCharacter();
  }

  confirm(): void {
    this.applySelectedCharacter();
  }

  private applySelectedCharacter(): void {
    const next = CHARACTERS[this.selectedIndex];
    if (!next) return;
    game.characterId = next.id;
    game.characterDisplayName = next.displayName;
  }
}
