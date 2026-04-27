<script lang="ts">
  import { microToUnit, MICRO } from "@golf-crash/utils-shared";
  import { game, adjustBet, setBet } from "$lib/stores/game.svelte";
  import { t } from "$lib/i18n";

  const PRESETS = [0.1, 0.2, 0.4, 0.8];
</script>

<div class="bet">
  <div class="row">
    <button class="step" onclick={() => adjustBet(-10)} aria-label={t(game.lang, "decreaseBet")}
      >−</button
    >
    <div class="amount">{microToUnit(game.betMicro).toFixed(2)}</div>
    <button class="step" onclick={() => adjustBet(10)} aria-label={t(game.lang, "increaseBet")}
      >+</button
    >
  </div>

  <div class="presets">
    {#each PRESETS as preset}
      <button
        class="preset"
        class:active={Math.abs(microToUnit(game.betMicro) - preset) < 0.001}
        onclick={() => setBet(preset * MICRO)}
      >
        {preset.toFixed(1)}
      </button>
    {/each}
  </div>
</div>

<style>
  .bet {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .row {
    display: flex;
    align-items: center;
    background: #1a1c1f;
    border-radius: 7px;
    overflow: hidden;
  }

  .step {
    width: 38px;
    height: 30px;
    border: none;
    background: transparent;
    color: #fff;
    font-size: 18px;
    cursor: pointer;
  }

  .step:active {
    background: #0f1011;
  }

  .amount {
    flex: 1;
    text-align: center;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .presets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
  }

  .preset {
    height: 26px;
    border: 1px solid #3a3d42;
    background: #1a1c1f;
    color: #cfd2d6;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .preset.active {
    background: #ffb627;
    color: #2c2f33;
    border-color: #ffb627;
  }

  @media (min-width: 900px) and (orientation: landscape) {
    .step {
      width: 48px;
      height: 40px;
      font-size: 22px;
    }

    .amount {
      font-size: 16px;
    }

    .preset {
      height: 34px;
      font-size: 14px;
    }
  }
</style>
