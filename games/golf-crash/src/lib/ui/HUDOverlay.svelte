<script lang="ts">
  import { microToCurrencyString } from "@golf-crash/utils-shared";
  import { game } from "$lib/stores/game.svelte";
  import { cashOut } from "$lib/game/round";
  import BetPanel from "./BetPanel.svelte";
  import PrimaryActionButton from "./PrimaryActionButton.svelte";
  import { t } from "$lib/i18n";

  const flagColor = (o: typeof game.history[number]): string => {
    switch (o) {
      case "fairway":
        return "#ffb627";
      case "cashout":
        return "#3bcc6b";
      case "jackpot":
        return "#ffd700";
      case "sand":
        return "#c8a26b";
      case "water":
        return "#e94c4c";
    }
  };
</script>

<div class="hud">
  <div class="topRow">
    <div class="avatar">
      <div class="avatarCircle" aria-hidden="true">
        <span>TS</span>
      </div>
      <div class="avatarMeta">
        <div class="charName">{game.characterDisplayName.toUpperCase()}</div>
        <div class="balance">{microToCurrencyString(game.balanceMicro)} {game.currency}</div>
      </div>
    </div>

    <div class="multiplierBadge" class:dim={game.phase !== "flight"}>
      <span class="x">x</span>
      <span class="value">{game.multiplier.toFixed(2)}</span>
    </div>

    <div class="winnings">
      <div class="winLabel">{t(game.lang, "currentWinnings")}</div>
      <div class="winValue">{microToCurrencyString(game.winningsMicro)}</div>
      <div class="historyLabel">{t(game.lang, "history")}</div>
      <div class="historyRow">
        {#each game.history as outcome, i (i)}
          <span class="flag" style="--c:{flagColor(outcome)}"></span>
        {/each}
      </div>
    </div>
  </div>

  <BetPanel />
  {#if game.phase === "landed"}
    <button class="secondaryCashOut" onclick={() => void cashOut()}>
      <span>{t(game.lang, "cashOut")}</span>
      <strong>{microToCurrencyString(game.winningsMicro)}</strong>
    </button>
  {/if}
  <PrimaryActionButton />
  {#if game.lastError}
    <div class="error">{game.lastError}</div>
  {/if}
</div>

<style>
  .hud {
    flex: 0 0 auto;
    background: #2c2f33;
    color: #fff;
    padding: 8px 12px 10px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid #1a1c1f;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    container-type: inline-size;
  }

  .topRow {
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .avatar {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 60px;
  }

  .avatarCircle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f0d28b, #b6884a);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 15px;
    color: #2c2f33;
    border: 2px solid #fff;
  }

  .avatarMeta {
    text-align: center;
    line-height: 1.1;
  }

  .charName {
    font-size: 10px;
    letter-spacing: 0.5px;
    font-weight: 700;
  }

  .balance {
    font-size: 11px;
    color: #ffb627;
    font-weight: 600;
  }

  .multiplierBadge {
    display: flex;
    align-items: baseline;
    gap: 2px;
    background: linear-gradient(180deg, #ffd76b 0%, #ffb627 60%, #d68a0a 100%);
    color: #2c2f33;
    padding: 4px 12px;
    border-radius: 8px;
    font-weight: 900;
    box-shadow: 0 2px 0 #8a5a00;
    transition: opacity 0.2s;
  }

  .multiplierBadge.dim {
    opacity: 0.6;
  }

  .multiplierBadge .x {
    font-size: 13px;
  }

  .multiplierBadge .value {
    font-size: 19px;
  }

  .winnings {
    font-size: 9px;
    line-height: 1.25;
  }

  .winLabel,
  .historyLabel {
    color: #cfd2d6;
    letter-spacing: 0.5px;
  }

  .winValue {
    font-size: 13px;
    color: #ffb627;
    font-weight: 700;
  }

  .historyRow {
    display: flex;
    gap: 3px;
    margin-top: 2px;
    flex-wrap: wrap;
  }

  .flag {
    width: 10px;
    height: 13px;
    background: var(--c);
    clip-path: polygon(0 0, 100% 0, 100% 60%, 50% 60%, 50% 100%, 0 100%);
    display: inline-block;
  }

  .error {
    font-size: 11px;
    color: #ff7070;
    text-align: center;
  }

  .secondaryCashOut {
    width: 100%;
    min-height: 42px;
    border: none;
    border-radius: 8px;
    background: linear-gradient(180deg, #ffb627 0%, #d68a0a 100%);
    color: #2c2f33;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 3px 0 #8a5a00;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-transform: uppercase;
  }

  /* Desktop / landscape side rail */
  @media (min-width: 900px) and (orientation: landscape) {
    .hud {
      width: 340px;
      max-width: 35vw;
      border-top: none;
      border-left: 1px solid #1a1c1f;
      padding: 16px 18px;
      gap: 14px;
      justify-content: flex-start;
    }

    .topRow {
      grid-template-columns: 1fr;
      gap: 14px;
    }

    .avatar {
      width: 100%;
      flex-direction: row;
      gap: 12px;
      align-items: center;
    }

    .avatarCircle {
      width: 56px;
      height: 56px;
      font-size: 19px;
    }

    .avatarMeta {
      text-align: left;
    }

    .charName {
      font-size: 13px;
    }

    .balance {
      font-size: 16px;
    }

    .multiplierBadge {
      align-self: center;
      padding: 8px 24px;
      border-radius: 12px;
    }

    .multiplierBadge .x {
      font-size: 18px;
    }

    .multiplierBadge .value {
      font-size: 32px;
    }

    .winnings {
      font-size: 12px;
    }

    .winValue {
      font-size: 18px;
    }

    .historyLabel {
      margin-top: 6px;
    }

    .flag {
      width: 14px;
      height: 18px;
    }
  }

  /* Wider phones / small tablets in portrait — give the bottom HUD a touch more breathing room */
  @media (min-width: 480px) and (orientation: portrait) {
    .hud {
      padding: 12px 18px 14px;
      gap: 10px;
    }

    .avatarCircle {
      width: 52px;
      height: 52px;
      font-size: 17px;
    }

    .multiplierBadge .value {
      font-size: 24px;
    }

    .winValue {
      font-size: 16px;
    }
  }
</style>
