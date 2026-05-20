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

export type ForgePanelOpenMode = "peek" | "pinned";

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
  openMode: ForgePanelOpenMode | null;
  activeSurface: ForgeRailSurface | null;
  pinnedSurface: ForgeRailSurface | null;
  activeRegistration: ForgePanelRegistration | null;
  openSurface: (
    surface: ForgeRailSurface,
    options?: { mode?: ForgePanelOpenMode },
  ) => void;
  togglePinnedSurface: (
    surface: ForgeRailSurface,
    options?: { unpinBehavior?: "peek" | "close" },
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
  openMode: null,
  activeSurface: null,
  pinnedSurface: null,
  activeRegistration: null,
  openSurface: () => undefined,
  togglePinnedSurface: () => undefined,
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
  const [open, setOpen] = React.useState(false);
  const [openMode, setOpenMode] = React.useState<ForgePanelOpenMode | null>(
    null,
  );
  const [activeSurface, setActiveSurface] =
    React.useState<ForgeRailSurface | null>(null);
  const [pinnedSurface, setPinnedSurface] =
    React.useState<ForgeRailSurface | null>(null);
  const activeSurfaceRef = React.useRef<ForgeRailSurface | null>(null);
  const openModeRef = React.useRef<ForgePanelOpenMode | null>(null);
  const pinnedSurfaceRef = React.useRef<ForgeRailSurface | null>(null);
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
    pinnedSurfaceRef.current = pinnedSurface;
  }, [pinnedSurface]);

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
      const mode = options?.mode ?? "pinned";
      clearOpenIntent();
      clearCloseIntent();
      activeSurfaceRef.current = surface;
      openModeRef.current = mode;
      pinnedSurfaceRef.current = mode === "pinned" ? surface : null;
      setActiveSurface(surface);
      setOpenMode(mode);
      setPinnedSurface(mode === "pinned" ? surface : null);
      setOpen(true);
    },
    [clearCloseIntent, clearOpenIntent],
  );

  const togglePinnedSurface = React.useCallback(
    (
      surface: ForgeRailSurface,
      options?: { unpinBehavior?: "peek" | "close" },
    ) => {
      clearOpenIntent();
      clearCloseIntent();
      const samePinnedSurface =
        pinnedSurfaceRef.current === surface &&
        activeSurfaceRef.current === surface &&
        openModeRef.current === "pinned";

      if (samePinnedSurface) {
        pinnedSurfaceRef.current = null;
        setPinnedSurface(null);
        if (options?.unpinBehavior === "close") {
          activeSurfaceRef.current = null;
          openModeRef.current = null;
          setOpen(false);
          setOpenMode(null);
          setActiveSurface(null);
          return;
        }
        setOpen(true);
        activeSurfaceRef.current = surface;
        openModeRef.current = "peek";
        setOpenMode("peek");
        setActiveSurface(surface);
        return;
      }

      setOpen(true);
      activeSurfaceRef.current = surface;
      openModeRef.current = "pinned";
      pinnedSurfaceRef.current = surface;
      setOpenMode("pinned");
      setPinnedSurface(surface);
      setActiveSurface(surface);
    },
    [clearCloseIntent, clearOpenIntent],
  );

  const closePanel = React.useCallback(() => {
    clearOpenIntent();
    clearCloseIntent();
    activeSurfaceRef.current = null;
    openModeRef.current = null;
    pinnedSurfaceRef.current = null;
    setOpen(false);
    setOpenMode(null);
    setPinnedSurface(null);
    setActiveSurface(null);
  }, [clearCloseIntent, clearOpenIntent]);

  const queueOpenSurface = React.useCallback(
    (surface: ForgeRailSurface) => {
      if (pinnedSurfaceRef.current) return;
      clearOpenIntent();
      clearCloseIntent();
      openIntentTimerRef.current = window.setTimeout(() => {
        openIntentTimerRef.current = null;
        if (pinnedSurfaceRef.current) return;
        activeSurfaceRef.current = surface;
        openModeRef.current = "peek";
        pinnedSurfaceRef.current = null;
        setActiveSurface(surface);
        setOpenMode("peek");
        setPinnedSurface(null);
        setOpen(true);
      }, HOVER_OPEN_DELAY_MS);
    },
    [clearCloseIntent, clearOpenIntent],
  );

  const queueClosePanel = React.useCallback(() => {
    if (pinnedSurfaceRef.current) return;
    clearCloseIntent();
    closeIntentTimerRef.current = window.setTimeout(() => {
      closeIntentTimerRef.current = null;
      if (pinnedSurfaceRef.current) return;
      activeSurfaceRef.current = null;
      openModeRef.current = null;
      setOpen(false);
      setOpenMode(null);
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
    },
    [clearCloseIntent, clearOpenIntent],
  );

  const registerTemplates = React.useCallback(
    (registration: ForgeTemplateRegistration) => {
      const panelRegistration: ForgePanelRegistration = {
        ...registration,
        kind: "templates",
      };
      setRegistrations((current) => ({
        ...current,
        [registration.surface]: panelRegistration,
      }));

      return () => {
        setRegistrations((current) => {
          if (current[registration.surface] !== panelRegistration) {
            return current;
          }
          const next = { ...current };
          delete next[registration.surface];
          return next;
        });
      };
    },
    [],
  );

  const registerPanel = React.useCallback(
    (registration: ForgeCustomPanelRegistration) => {
      const panelRegistration: ForgePanelRegistration = {
        ...registration,
        kind: "custom",
      };
      setRegistrations((current) => ({
        ...current,
        [registration.surface]: panelRegistration,
      }));

      return () => {
        setRegistrations((current) => {
          if (current[registration.surface] !== panelRegistration) {
            return current;
          }
          const next = { ...current };
          delete next[registration.surface];
          return next;
        });
      };
    },
    [],
  );

  const activeRegistration = activeSurface
    ? registrations[activeSurface] ?? null
    : null;

  const value = React.useMemo<ForgeTemplatePanelContextValue>(
    () => ({
      open,
      openMode,
      activeSurface,
      pinnedSurface,
      activeRegistration,
      openSurface,
      togglePinnedSurface,
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
      pinnedSurface,
      queueClosePanel,
      queueOpenSurface,
      registerTemplates,
      registerPanel,
      togglePinnedSurface,
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
