import { translateUi, type UiMessageKey } from "./i18n";
import type { ProductionUiLocale } from "./locale-registry";

export type SettingsTab =
  | "account"
  | "theme"
  | "language"
  | "docstyle"
  | "voice"
  | "billing"
  | "team"
  | "danger";

export const SETTINGS_TABS: Array<{
  id: SettingsTab;
  labelKey: UiMessageKey;
  descriptionKey: UiMessageKey;
}> = [
  {
    id: "account",
    labelKey: "settings.tabs.account.label",
    descriptionKey: "settings.tabs.account.description",
  },
  {
    id: "theme",
    labelKey: "settings.tabs.theme.label",
    descriptionKey: "settings.tabs.theme.description",
  },
  {
    id: "language",
    labelKey: "settings.tabs.language.label",
    descriptionKey: "settings.tabs.language.description",
  },
  {
    id: "docstyle",
    labelKey: "settings.tabs.docstyle.label",
    descriptionKey: "settings.tabs.docstyle.description",
  },
  {
    id: "voice",
    labelKey: "settings.tabs.voice.label",
    descriptionKey: "settings.tabs.voice.description",
  },
  {
    id: "billing",
    labelKey: "settings.tabs.billing.label",
    descriptionKey: "settings.tabs.billing.description",
  },
  {
    id: "team",
    labelKey: "settings.tabs.team.label",
    descriptionKey: "settings.tabs.team.description",
  },
  {
    id: "danger",
    labelKey: "settings.tabs.danger.label",
    descriptionKey: "settings.tabs.danger.description",
  },
];

export function normalizeSettingsTab(value: string | null): SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.id === value)
    ? (value as SettingsTab)
    : "account";
}

export function getSettingsTabLabel(
  tabId: SettingsTab,
  locale: ProductionUiLocale = "en",
): string {
  const tab = SETTINGS_TABS.find((candidate) => candidate.id === tabId);
  return tab ? translateUi(locale, tab.labelKey) : translateUi(locale, "nav.settings");
}

export function getSettingsTabDescription(
  tabId: SettingsTab,
  locale: ProductionUiLocale = "en",
): string {
  const tab = SETTINGS_TABS.find((candidate) => candidate.id === tabId);
  return tab
    ? translateUi(locale, tab.descriptionKey)
    : translateUi(locale, "nav.settings");
}

export function getSettingsTabPath(tabId: SettingsTab): string {
  return tabId === "account" ? "/settings" : `/settings?tab=${tabId}`;
}
