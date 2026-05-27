import {
  DEFAULT_UI_LOCALE,
  ENABLED_UI_LOCALES,
  normalizeUiLocale,
  type ProductionUiLocale,
} from "../locale-registry";
import {
  EN_UI_MESSAGES,
  UI_MESSAGES,
  type UiMessageKey,
  type UiMessageLocale,
} from "./ui-messages";

export function normalizeUiMessageLocale(
  locale: string | null | undefined,
): UiMessageLocale {
  const normalized = normalizeUiLocale(locale);
  return (ENABLED_UI_LOCALES as readonly ProductionUiLocale[]).includes(
    normalized,
  )
    ? normalized
    : DEFAULT_UI_LOCALE;
}

export function getUiMessage(
  locale: string | null | undefined,
  key: UiMessageKey,
): string {
  const resolvedLocale = normalizeUiMessageLocale(locale);
  const localized = UI_MESSAGES[resolvedLocale]?.[key];
  const fallback = EN_UI_MESSAGES[key];
  return localized || fallback || key;
}

export const translateUi = getUiMessage;
