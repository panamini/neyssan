import type { UiMessageKey } from "./i18n";

export type CommandGroup = "Create" | "Go to" | "Actions";

export type CommandAction =
  | { type: "navigate"; to: string }
  | { type: "quick-start"; mode?: "resume-upload" | "default" }
  | { type: "replay-onboarding" }
  | { type: "toggle-theme" }
  | { type: "sign-out" };

export type AppCommand = {
  id: string;
  group: CommandGroup;
  label: string;
  labelKey?: UiMessageKey;
  shortcut?: string;
  keywords?: string[];
  action: CommandAction;
};

export const APP_COMMANDS: AppCommand[] = [
  {
    id: "new-proposal",
    group: "Create",
    label: "New proposal",
    labelKey: "today.actions.newProposal",
    shortcut: "Cmd N",
    keywords: ["cover letter", "proposal forge"],
    action: { type: "navigate", to: "/proposal" },
  },
  {
    id: "import-cv",
    group: "Create",
    label: "Import CV",
    labelKey: "today.actions.importCv",
    shortcut: "Cmd Shift N",
    keywords: ["resume", "upload"],
    action: { type: "quick-start", mode: "resume-upload" },
  },
  {
    id: "dashboard",
    group: "Go to",
    label: "Today",
    labelKey: "nav.today",
    shortcut: "G D",
    action: { type: "navigate", to: "/dashboard" },
  },
  {
    id: "jobs",
    group: "Go to",
    label: "Jobs",
    labelKey: "nav.jobs",
    shortcut: "G J",
    action: { type: "navigate", to: "/jobs" },
  },
  {
    id: "proposal",
    group: "Go to",
    label: "Proposal forge",
    labelKey: "workspace.proposalForge",
    shortcut: "G P",
    action: { type: "navigate", to: "/proposal" },
  },
  {
    id: "cv",
    group: "Go to",
    label: "CV forge",
    labelKey: "workspace.cvForge",
    shortcut: "G C",
    keywords: ["resume"],
    action: { type: "navigate", to: "/cv" },
  },
  {
    id: "documents",
    group: "Go to",
    label: "Projects",
    labelKey: "nav.projects",
    shortcut: "G L",
    keywords: ["library", "documents", "proposals", "resumes"],
    action: { type: "navigate", to: "/documents" },
  },
  {
    id: "templates",
    group: "Go to",
    label: "Templates",
    labelKey: "nav.templates",
    shortcut: "G T",
    keywords: ["style"],
    action: { type: "navigate", to: "/templates" },
  },
  {
    id: "settings",
    group: "Go to",
    label: "Settings",
    labelKey: "nav.settings",
    shortcut: "G S",
    action: { type: "navigate", to: "/settings" },
  },
  {
    id: "quick-start",
    group: "Actions",
    label: "Starter tour",
    labelKey: "onboarding.replay",
    keywords: ["start", "setup"],
    action: { type: "replay-onboarding" },
  },
  {
    id: "toggle-theme",
    group: "Actions",
    label: "Toggle light or dark",
    labelKey: "command.toggleTheme",
    shortcut: "Cmd Shift T",
    keywords: ["theme"],
    action: { type: "toggle-theme" },
  },
  {
    id: "sign-out",
    group: "Actions",
    label: "Sign out",
    labelKey: "account.signOut",
    action: { type: "sign-out" },
  },
];

export const COMMAND_GROUPS: CommandGroup[] = ["Create", "Go to", "Actions"];
