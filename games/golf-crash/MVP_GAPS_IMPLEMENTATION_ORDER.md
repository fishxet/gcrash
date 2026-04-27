# Golf Crash MVP: Blocking Gaps and Implementation Order

## Scope

This document captures blocking MVP gaps and the execution order to close them.
The sequence is fixed: `RGS -> Provably Fair verify -> UI flows -> i18n/demo`.

## Blocking MVP Gaps

### 1) RGS wallet flow is not implemented (Critical blocker)

- **Why it blocks MVP:** no real money/session lifecycle (`authenticate`, `bet`, `win`) means game rounds cannot be integrated with operator wallet accounting.
- **Evidence in code:**
  - `games/golf-crash/src/lib/services/rgs.ts` -> `authenticate()` throws `"authenticate not implemented"`.
  - `games/golf-crash/src/lib/services/rgs.ts` -> `placeBet()` throws `"placeBet not implemented"`.
  - `games/golf-crash/src/lib/services/rgs.ts` -> `claimWin()` throws `"claimWin not implemented"`.
- **Definition of done:**
  - HTTP client and typed request/response contracts for RGS endpoints are implemented.
  - Round lifecycle calls are wired: pre-round auth/session refresh, debit on start, credit on win/cashout.
  - Error mapping and retry/idempotency rules are explicit.

### 2) Provably Fair verify/proof flow is missing (Critical blocker)

- **Why it blocks MVP:** user cannot independently verify round fairness; compliance and trust requirement is not met.
- **Evidence in code:**
  - `games/golf-crash/src/lib/services/provablyFair.ts` -> `verify()` throws `"verify not implemented"`.
  - Math generation exists in `games/golf-crash/src/lib/game/math.ts` (`floats`, `generatePlan`) but no external proof verification bridge.
- **Definition of done:**
  - `verify()` reproduces deterministic result from proof payload (`serverSeed`, `clientSeed`, `nonce`) and compares to reported round outcome.
  - Proof object for completed rounds is persisted/exposed to UI.
  - Failure states are user-visible (invalid proof or unavailable verification data).

### 3) Gameplay UI flows for Character Select and Bonus are skeletal (High blocker)

- **Why it blocks MVP:** required user-visible flows are not functional; progression/bonus experience is incomplete.
- **Evidence in code:**
  - `games/golf-crash/src/lib/game/scenes/CharacterSelectScene.ts` has empty `next()`, `prev()`, `confirm()`.
  - `games/golf-crash/src/lib/game/scenes/BonusScene.ts` contains only empty container setup.
- **Definition of done:**
  - Character selection has state, navigation, and confirmation that affects active run/player visuals.
  - Bonus scene has trigger, render loop/state transitions, and payout/result handoff.
  - Main HUD action states remain consistent with round phases (see `PrimaryActionButton.svelte` and `round.ts`).

### 4) i18n and explicit demo mode are absent (Medium blocker, required before release)

- **Why it blocks MVP:** localization requirements and operational mode separation (real/demo) are not formalized.
- **Evidence in code:**
  - `games/golf-crash/src/lib/ui/PrimaryActionButton.svelte` uses hardcoded English labels (`"SHOOT"`, `"CASH OUT"`, etc.).
  - No observable language parameter handling in reviewed game service/ui entry points.
  - No explicit `demo` flag/model in reviewed round/service modules (`round.ts`, `rgs.ts`).
- **Definition of done:**
  - Text strings are moved to translation dictionaries and resolved by runtime language.
  - `lang` parameter is parsed and applied to UI formatting/messages.
  - Demo mode is explicit (config/store flag), with wallet/network behavior separated from real-money mode.

## Implementation Order

## 1. RGS

- Establish RGS transport, auth/session bootstrap, and wallet methods in `services/rgs.ts`.
- Integrate round callbacks:
  - start -> bet/debit,
  - crash/lose -> settle zero,
  - cashout/landed -> win/credit.
- Add guardrails first: timeout policy, idempotency keys, and typed error surfaces.

## 2. Provably Fair verify

- Implement `services/provablyFair.ts::verify`.
- Build proof payload contract from round outputs generated in `math.ts`.
- Expose per-round proof data and verification status for UI consumption.

## 3. UI flows (Character Select + Bonus)

- Complete `CharacterSelectScene` selection loop and confirmation side effects.
- Implement `BonusScene` state machine and transition in/out with payout/result propagation.
- Ensure phase synchronization with existing round states in `round.ts`.

## 4. i18n + demo mode

- Introduce translation layer and replace hardcoded UI strings (start from `PrimaryActionButton.svelte`).
- Parse/apply `lang` parameter globally for game UI and formatted strings.
- Add explicit demo mode flag and route gameplay:
  - demo -> local/mock wallet path,
  - real -> RGS wallet path.

## Dependency Rationale

- RGS first: all financial state transitions depend on live wallet contract.
- Provably Fair second: verification payload should align with final wallet-settled round model.
- UI flows third: these flows consume stabilized backend/service behavior.
- i18n/demo last: horizontal enablement layer over finalized flows and service contracts.
