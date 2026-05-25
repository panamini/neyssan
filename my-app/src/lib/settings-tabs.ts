export type SettingsTab =
  | "account"
  | "preferences"
  | "docstyle"
  | "voice"
  | "billing"
  | "team"
  | "danger";

export const SETTINGS_TABS: Array<{
  id: SettingsTab;
  label: string;
  description: string;
}> = [
  {
    id: "account",
    label: "Profile",
    description: "Profile, contact defaults, connected accounts.",
  },
  {
    id: "preferences",
    label: "Preferences",
    description: "Theme and motion preferences.",
  },
  {
    id: "docstyle",
    label: "Document style",
    description: "Fonts, colors, layouts, and printed name.",
  },
  {
    id: "voice",
    label: "Voice & tone",
    description: "Default writing tone for new proposals.",
  },
  {
    id: "billing",
    label: "Billing",
    description: "Plan and payment controls.",
  },
  {
    id: "team",
    label: "Team",
    description: "Members and workspace access.",
  },
  {
    id: "danger",
    label: "Danger zone",
    description: "Account deletion and irreversible actions.",
  },
];

export function normalizeSettingsTab(value: string | null): SettingsTab {
  return SETTINGS_TABS.some((tab) => tab.id === value)
    ? (value as SettingsTab)
    : "account";
}

export function getSettingsTabLabel(tabId: SettingsTab): string {
  return SETTINGS_TABS.find((tab) => tab.id === tabId)?.label ?? "Settings";
}

export function getSettingsTabPath(tabId: SettingsTab): string {
  return tabId === "account" ? "/settings" : `/settings?tab=${tabId}`;
}
