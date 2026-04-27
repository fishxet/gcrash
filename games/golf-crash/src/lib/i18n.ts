export type AppLang = "en" | "ru";

type TranslationKey =
  | "shoot"
  | "cashOut"
  | "crashed"
  | "cashedOut"
  | "lowBalance"
  | "currentWinnings"
  | "history"
  | "decreaseBet"
  | "increaseBet";

const MESSAGES: Record<AppLang, Record<TranslationKey, string>> = {
  en: {
    shoot: "SHOOT",
    cashOut: "CASH OUT",
    crashed: "CRASHED",
    cashedOut: "CASHED OUT",
    lowBalance: "LOW BALANCE",
    currentWinnings: "CURRENT WINNINGS",
    history: "HISTORY",
    decreaseBet: "decrease bet",
    increaseBet: "increase bet",
  },
  ru: {
    shoot: "УДАР",
    cashOut: "ЗАБРАТЬ",
    crashed: "КРАШ",
    cashedOut: "ЗАБРАНО",
    lowBalance: "МАЛО СРЕДСТВ",
    currentWinnings: "ТЕКУЩИЙ ВЫИГРЫШ",
    history: "ИСТОРИЯ",
    decreaseBet: "уменьшить ставку",
    increaseBet: "увеличить ставку",
  },
};

export const normalizeLang = (value: string | null | undefined): AppLang => {
  if (!value) return "en";
  return value.toLowerCase().startsWith("ru") ? "ru" : "en";
};

export const t = (lang: AppLang, key: TranslationKey): string => MESSAGES[lang][key];
