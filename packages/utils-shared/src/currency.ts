import { MICRO } from "./constants.js";

export const microToUnit = (micro: number): number => micro / MICRO;

export const unitToMicro = (unit: number): number => Math.round(unit * MICRO);

export const numberToCurrencyString = (
  amount: number,
  currency = "USD",
  locale = "en-US",
): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);

export const microToCurrencyString = (
  micro: number,
  currency = "USD",
  locale = "en-US",
): string => numberToCurrencyString(microToUnit(micro), currency, locale);
