import React from "react";

import type { TemplateFamily } from "../pages/TemplatesPage";

export type ForgeTemplateSurface = "cv" | "proposal";
export type ForgeRailSurface =
  | ForgeTemplateSurface
  | "cv-sections"
  | "cv-design"
  | "proposal-heading"
  | "proposal-design"
  | "proposal-draft"
  | "proposal-paste-job"
  | "jobs"
  | "documents"
  | "cvs"
  | "proposals"
  | "settings";

export type ForgePanelOpenMode = "closed" | "peek" | "overlay" | "docked";

export type ForgeTemplateItem = {
  id: string;
  label: string;
  description?: string | null;
  meta?: string | null;
  preview?: {
    kind: "Cover letter" | "Resume";
    family: TemplateFamily;
  };
};

export type ForgeTemplateRegistration = {
  surface: ForgeTemplateSurface;
  title: string;
  subtitle?: string;
  activeItemId?: string | null;
  items: ForgeTemplateItem[];
  onSelect: (itemId: string) => void;
};

export type ForgeCustomPanelRegistration = {
  surface: Exclude<ForgeRailSurface, ForgeTemplateSurface>;
  title: string;
  ariaLabel?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  backAction?: {
    ariaLabel: string;
    onSelect: () => void;
  } | null;
  renderContent: () => React.ReactNode;
  footer?: {
    label: string;
    icon?: React.ReactNode;
    onSelect: () => void;
  } | null;
};

export type ForgePanelRegistration =
  | (ForgeTemplateRegistration & { kind: "templates" })
  | (ForgeCustomPanelRegistration & { kind: "custom" });

type ForgeTemplatePanelContextValue = {
  open: boolean;
  openMode: ForgePanelOpenMode;
  activeSurface: ForgeRailSurface | null;
  dockedSurface: ForgeRailSurface | null;
  activeRegistration: ForgePanelRegistration | null;
  openSurface: (
    surface: ForgeRailSurface,
    options?: { mode?: ForgePanelOpenMode },
  ) => void;
  closePanel: () => void;
  queueOpenSurface: (surface: ForgeRailSurface) => void;
  queueClosePanel: () => void;
  cancelPanelClose: () => void;
  registerTemplates: (registration: ForgeTemplateRegistration) => () => void;
  registerPanel: (registration: ForgeCustomPanelRegistration) => () => void;
};

const DEFAULT_FORGE_TEMPLATE_PANEL_CONTEXT: ForgeTemplatePanelContextValue = {
  open: false,
  openMode: "closed",
  activeSurface: null,
  dockedSurface: null,
  activeRegistration: null,
  openSurface: () => undefined,
  closePanel: () => undefined,
  queueOpenSurface: () => undefined,
  queueClosePanel: () => undefined,
  cancelPanelClose: () => undefined,
  registerTemplates: () => () => undefined,
  registerPanel: () => () => undefined,
};

const ForgeTemplatePanelContext =
  React.createContext<ForgeTemplatePanelContextValue>(
    DEFAULT_FORGE_TEMPLATE_PANEL_CONTEXT,
  );

const HOVER_OPEN_DELAY_MS = 150;
const HOVER_CLOSE_DELAY_MS = 360;

export function ForgeTemplatePanelProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const openIntentTimerRef = React.useRef<number | null>(null);
  const closeIntentTimerRef = React.useRef<number | null>(null);
  const registrationSerialRef = React.useRef(0);
  const activeRegistrationTokensRef = React.useRef<
    Partial<Record<ForgeRailSurface, number>>
  >({});
  const pendingRegistrationCleanupTimersRef = React.useRef<
    Partial<Record<ForgeRailSurface, number>>
  >({});
  const [open, setOpen] = React.useState(false);
  const [openMode, setOpenMode] =
    React.useState<ForgePanelOpenMode>("closed");
  const [activeSurface, setActiveSurface] =
    React.useState<ForgeRailSurface | null>(null);
  const [dockedSurface, setDockedSurface] =
    React.useState<ForgeRailSurface | null>(null);
  const activeSurfaceRef = React.useRef<ForgeRailSurface | null>(null);
  const openModeRef = React.useRef<ForgePanelOpenMode>("closed");
  const dockedSurfaceRef = React.useRef<ForgeRailSurface | null>(null);
  const [registrations, setRegistrations] = React.useState<
    Partial<Record<ForgeRailSurface, ForgePanelRegistration>>
  >({});

  React.useEffect(() => {
    activeSurfaceRef.current = activeSurface;
  }, [activeSurface]);

  React.useEffect(() => {
    openModeRef.current = openMode;
  }, [openMode]);

  React.useEffect(() => {
    dockedSurfaceRef.current = dockedSurface;
  }, [dockedSurface]);

  const clearOpenIntent = React.useCallback(() => {
    if (openIntentTimerRef.current === null) return;
    window.clearTimeout(openIntentTimerRef.current);
    openIntentTimerRef.current = null;
  }, []);

  const clearCloseIntent = React.useCallback(() => {
    if (closeIntentTimerRef.current === null) return;
    window.clearTimeout(closeIntentTimerRef.current);
    closeIntentTimerRef.current = null;
  }, []);

  const openSurface = React.useCallback(
    (
      surface: ForgeRailSurface,
      options?: { mode?: ForgePanelOpenMode },
    ) => {
      const mode =
        options?.mode ?? (openModeRef.current === "docked" ? "docked" : "overlay");
      clearOpenIntent();
      clearCloseIntent();
      const nextSurface = mode === "closed" ? null : surface;
      activeSurfaceRef.current = nextSurface;
      openModeRef.current = mode;
      dockedSurfaceRef.current = mode === "docked" ? surface : null;
      setActiveSurface(nextSurface);
      setOpenMode(mode);
      setDockedSurface(mode === "docked" ? surface : null);
      setOpen(mode !== "closed");
    },
    [clearCloseIntent, clearOpenIntent],
  );

  const closePanel = React.useCallback(() => {
    clearOpenIntent();
    clearCloseIntent();
    activeSurfaceRef.current = null;
    openModeRef.current = "closed";
    dockedSurfaceRef.current = null;
    setOpen(false);
    setOpenMode("closed");
    setDockedSurface(null);
    setActiveSurface(null);
  }, [clearCloseIntent, clearOpenIntent]);

  const queueOpenSurface = React.useCallback(
    (surface: ForgeRailSurface) => {
      if (openModeRef.current === "overlay" || openModeRef.current === "docked") {
        return;
      }
      clearOpenIntent();
      clearCloseIntent();
      openIntentTimerRef.current = window.setTimeout(() => {
        openIntentTimerRef.current = null;
        if (
          openModeRef.current === "overlay" ||
          openModeRef.current === "docked"
        ) {
          return;
        }
        activeSurfaceRef.current = surface;
        openModeRef.current = "peek";
        dockedSurfaceRef.current = null;
        setActiveSurface(surface);
        setOpenMode("peek");
        setDockedSurface(null);
        setOpen(true);
      }, HOVER_OPEN_DELAY_MS);
    },
    [clearCloseIntent, clearOpenIntent],
  );

  const queueClosePanel = React.useCallback(() => {
    if (openModeRef.current !== "peek") return;
    clearCloseIntent();
    closeIntentTimerRef.current = window.setTimeout(() => {
      closeIntentTimerRef.current = null;
      if (openModeRef.current !== "peek") return;
      activeSurfaceRef.current = null;
      openModeRef.current = "closed";
      setOpen(false);
      setOpenMode("closed");
      setActiveSurface(null);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseIntent]);

  const cancelPanelClose = React.useCallback(() => {
    clearCloseIntent();
  }, [clearCloseIntent]);

  React.useEffect(
    () => () => {
      clearOpenIntent();
      clearCloseIntent();
      Object.values(pendingRegistrationCleanupTimersRef.current).forEach(
        (timerId) => {
          if (typeof timerId === "number") {
            window.clearTimeout(timerId);
          }
        },
      );
      pendingRegistrationCleanupTimersRef.current = {};
    },
    [clearCloseIntent, clearOpenIntent],
  );

  const cancelRegistrationCleanup = React.useCallback(
    (surface: ForgeRailSurface) => {
      const timerId = pendingRegistrationCleanupTimersRef.current[surface];
      if (typeof timerId !== "number") {
        return;
      }
      window.clearTimeout(timerId);
      delete pendingRegistrationCleanupTimersRef.current[surface];
    },
    [],
  );

  const scheduleRegistrationCleanup = React.useCallback(
    (args: {
      surface: ForgeRailSurface;
      token: number;
      registration: ForgePanelRegistration;
    }) => {
      cancelRegistrationCleanup(args.surface);
      pendingRegistrationCleanupTimersRef.current[args.surface] =
        window.setTimeout(() => {
          delete pendingRegistrationCleanupTimersRef.current[args.surface];
          if (activeRegistrationTokensRef.current[args.surface] !== args.token) {
            return;
          }
          delete activeRegistrationTokensRef.current[args.surface];
          setRegistrations((current) => {
            if (current[args.surface] !== args.registration) {
              return current;
            }
            const next = { ...current };
            delete next[args.surface];
            return next;
          });
        }, 0);
    },
    [cancelRegistrationCleanup],
  );

  const registerTemplates = React.useCallback(
    (registration: ForgeTemplateRegistration) => {
      const panelRegistration: ForgePanelRegistration = {
        ...registration,
        kind: "templates",
      };
      const token = ++registrationSerialRef.current;
      activeRegistrationTokensRef.current[registration.surface] = token;
      cancelRegistrationCleanup(registration.surface);
      setRegistrations((current) => ({
        ...current,
        [registration.surface]: panelRegistration,
      }));

      return () => {
        scheduleRegistrationCleanup({
          surface: registration.surface,
          token,
          registration: panelRegistration,
        });
      };
    },
    [cancelRegistrationCleanup, scheduleRegistrationCleanup],
  );

  const registerPanel = React.useCallback(
    (registration: ForgeCustomPanelRegistration) => {
      const panelRegistration: ForgePanelRegistration = {
        ...registration,
        kind: "custom",
      };
      const token = ++registrationSerialRef.current;
      activeRegistrationTokensRef.current[registration.surface] = token;
      cancelRegistrationCleanup(registration.surface);
      setRegistrations((current) => ({
        ...current,
        [registration.surface]: panelRegistration,
      }));

      return () => {
        scheduleRegistrationCleanup({
          surface: registration.surface,
          token,
          registration: panelRegistration,
        });
      };
    },
    [cancelRegistrationCleanup, scheduleRegistrationCleanup],
  );

  const activeRegistration = activeSurface
    ? registrations[activeSurface] ?? null
    : null;

  const value = React.useMemo<ForgeTemplatePanelContextValue>(
    () => ({
      open,
      openMode,
      activeSurface,
      dockedSurface,
      activeRegistration,
      openSurface,
      closePanel,
      queueOpenSurface,
      queueClosePanel,
      cancelPanelClose,
      registerTemplates,
      registerPanel,
    }),
    [
      activeRegistration,
      activeSurface,
      closePanel,
      cancelPanelClose,
      open,
      openMode,
      openSurface,
      dockedSurface,
      queueClosePanel,
      queueOpenSurface,
      registerTemplates,
      registerPanel,
    ],
  );

  return (
    <ForgeTemplatePanelContext.Provider value={value}>
      {children}
    </ForgeTemplatePanelContext.Provider>
  );
}

export function useForgeTemplatePanel(): ForgeTemplatePanelContextValue {
  return React.useContext(ForgeTemplatePanelContext);
}

export function useRegisterForgeTemplates(
  registration: ForgeTemplateRegistration,
): void {
  const { registerTemplates } = useForgeTemplatePanel();

  React.useEffect(
    () => registerTemplates(registration),
    [registerTemplates, registration],
  );
}

export function useRegisterForgePanel(
  registration: ForgeCustomPanelRegistration,
): void {
  const { registerPanel } = useForgeTemplatePanel();

  React.useEffect(
    () => registerPanel(registration),
    [registerPanel, registration],
  );
}
