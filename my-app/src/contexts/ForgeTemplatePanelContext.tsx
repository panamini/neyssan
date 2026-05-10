import React from "react";

export type ForgeTemplateSurface = "cv" | "proposal";

export type ForgeTemplateItem = {
  id: string;
  label: string;
  description?: string | null;
  meta?: string | null;
};

export type ForgeTemplateRegistration = {
  surface: ForgeTemplateSurface;
  title: string;
  subtitle?: string;
  activeItemId?: string | null;
  items: ForgeTemplateItem[];
  onSelect: (itemId: string) => void;
};

type ForgeTemplatePanelContextValue = {
  open: boolean;
  activeSurface: ForgeTemplateSurface | null;
  activeRegistration: ForgeTemplateRegistration | null;
  openSurface: (surface: ForgeTemplateSurface) => void;
  closePanel: () => void;
  registerTemplates: (registration: ForgeTemplateRegistration) => () => void;
};

const DEFAULT_FORGE_TEMPLATE_PANEL_CONTEXT: ForgeTemplatePanelContextValue = {
  open: false,
  activeSurface: null,
  activeRegistration: null,
  openSurface: () => undefined,
  closePanel: () => undefined,
  registerTemplates: () => () => undefined,
};

const ForgeTemplatePanelContext =
  React.createContext<ForgeTemplatePanelContextValue>(
    DEFAULT_FORGE_TEMPLATE_PANEL_CONTEXT,
  );

export function ForgeTemplatePanelProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [activeSurface, setActiveSurface] =
    React.useState<ForgeTemplateSurface | null>(null);
  const [registrations, setRegistrations] = React.useState<
    Partial<Record<ForgeTemplateSurface, ForgeTemplateRegistration>>
  >({});

  const openSurface = React.useCallback((surface: ForgeTemplateSurface) => {
    setActiveSurface(surface);
    setOpen(true);
  }, []);

  const closePanel = React.useCallback(() => {
    setOpen(false);
  }, []);

  const registerTemplates = React.useCallback(
    (registration: ForgeTemplateRegistration) => {
      setRegistrations((current) => ({
        ...current,
        [registration.surface]: registration,
      }));

      return () => {
        setRegistrations((current) => {
          if (current[registration.surface] !== registration) {
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
      activeSurface,
      activeRegistration,
      openSurface,
      closePanel,
      registerTemplates,
    }),
    [
      activeRegistration,
      activeSurface,
      closePanel,
      open,
      openSurface,
      registerTemplates,
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
