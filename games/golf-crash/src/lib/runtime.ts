import { normalizeLang, type AppLang } from "./i18n.js";

export type RuntimeConfig = {
  lang: AppLang;
  demo: boolean;
  rgsUrl: string | null;
  sessionId: string | null;
  device: "desktop" | "mobile";
};

let cachedConfig: RuntimeConfig | null = null;

const toBool = (value: string | null): boolean => {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
};

const nonEmpty = (value: string | null): string | null => {
  if (!value) return null;
  const next = value.trim();
  return next.length === 0 ? null : next;
};

export const readRuntimeConfig = (): RuntimeConfig => {
  if (typeof window === "undefined") {
    return { lang: "en", demo: true, rgsUrl: null, sessionId: null, device: "desktop" };
  }
  const params = new URL(window.location.href).searchParams;
  const rgsUrl = nonEmpty(params.get("rgs_url")) ?? nonEmpty(params.get("rgsUrl"));
  const sessionId = nonEmpty(params.get("sessionID")) ?? nonEmpty(params.get("sessionId"));
  const device = params.get("device") === "mobile" ? "mobile" : "desktop";
  const demo = toBool(params.get("demo")) || !rgsUrl || !sessionId;
  return {
    lang: normalizeLang(params.get("lang")),
    demo,
    rgsUrl,
    sessionId,
    device,
  };
};

export const getRuntimeConfig = (): RuntimeConfig => {
  if (cachedConfig) return cachedConfig;
  cachedConfig = readRuntimeConfig();
  return cachedConfig;
};
