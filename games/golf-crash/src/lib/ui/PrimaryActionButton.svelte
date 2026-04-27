<script lang="ts">
  import { microToCurrencyString } from "@golf-crash/utils-shared";
  import { game } from "$lib/stores/game.svelte";
  import { startRound, cashOut } from "$lib/game/round";
  import { t } from "$lib/i18n";

  const handleClick = () => {
    if (isCashOut) cashOut();
    else void startRound();
  };

  const insufficient = $derived(game.balanceMicro < game.betMicro);
  const sandLocked = $derived(game.phase === "landed" && game.history.at(-1) === "sand");
  const isCashOut = $derived(game.phase === "flight" || sandLocked);
  const disabled = $derived(
    !isCashOut &&
      (insufficient ||
        game.phase === "cashOut" ||
        game.phase === "crashed" ||
        game.phase === "runToBall"),
  );

  const label = $derived.by(() => {
    if (isCashOut) return t(game.lang, "cashOut");
    if (game.phase === "crashed") return t(game.lang, "crashed");
    if (game.phase === "cashOut") return t(game.lang, "cashedOut");
    if (game.phase === "runToBall") return "RUNNING";
    if (insufficient) return t(game.lang, "lowBalance");
    return t(game.lang, "shoot");
  });

  const sub = $derived.by(() => {
    if (isCashOut)
      return microToCurrencyString(Math.round(game.betMicro * game.multiplier));
    if (game.phase === "crashed") return `x${game.crashAt.toFixed(2)}`;
    if (game.phase === "cashOut") return microToCurrencyString(game.winningsMicro);
    if (game.phase === "landed") return `x${game.multiplier.toFixed(2)}`;
    return microToCurrencyString(game.betMicro);
  });
</script>

<button class="primary" class:cashOut={isCashOut} {disabled} onclick={handleClick}>
  <span class="label">{label}</span>
  <span class="sub">{sub}</span>
</button>

<style>
  .primary {
    width: 100%;
    min-height: 46px;
    border: none;
    border-radius: 9px;
    background: linear-gradient(180deg, #4ad27a 0%, #2fa856 100%);
    color: #0d2814;
    font-weight: 800;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 3px 0 #1f7a3b;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
  }

  .primary:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 #1f7a3b;
  }

  .primary:disabled {
    background: linear-gradient(180deg, #4a4d52 0%, #3a3d42 100%);
    color: #8a8d92;
    box-shadow: 0 3px 0 #2a2d32;
    cursor: not-allowed;
  }

  .primary.cashOut {
    background: linear-gradient(180deg, #ffb627 0%, #d68a0a 100%);
    color: #2c2f33;
    box-shadow: 0 3px 0 #8a5a00;
  }

  .label {
    font-size: 14px;
    letter-spacing: 1px;
  }

  .sub {
    font-size: 11px;
    font-weight: 600;
  }

  @media (min-width: 900px) and (orientation: landscape) {
    .primary {
      min-height: 64px;
      border-radius: 12px;
    }

    .label {
      font-size: 18px;
      letter-spacing: 1.5px;
    }

    .sub {
      font-size: 14px;
    }
  }
</style>
