<script lang="ts">
  import { onMount } from "svelte";
  import { bootstrapGame } from "$lib/game/bootstrap";
  import HUDOverlay from "$lib/ui/HUDOverlay.svelte";
  import { getRuntimeConfig } from "$lib/runtime";
  import { game } from "$lib/stores/game.svelte";

  let canvas: HTMLCanvasElement;

  onMount(() => {
    const runtime = getRuntimeConfig();
    game.lang = runtime.lang;
    game.demoMode = runtime.demo;
    return bootstrapGame(canvas);
  });
</script>

<div class="stage">
  <div class="playfield">
    <canvas bind:this={canvas}></canvas>
  </div>
  <HUDOverlay />
</div>

<style>
  .stage {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: #000;
    overflow: hidden;
  }

  .playfield {
    flex: 1;
    position: relative;
    overflow: hidden;
    min-height: 0;
    min-width: 0;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Desktop / landscape: HUD as a side rail */
  @media (min-width: 900px) and (orientation: landscape) {
    .stage {
      flex-direction: row;
    }
  }
</style>
