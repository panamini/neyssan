import React from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useLocation, useNavigate } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import { APP_COMMANDS, COMMAND_GROUPS, type AppCommand } from "../lib/commands";
import { createQuickStartLocationState } from "../lib/quick-start-routing";
import { translateUi } from "../lib/i18n";
import { useUiLanguagePreference } from "../lib/ui-preferences";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplayOnboarding: () => void;
  onToggleTheme: () => void;
};

function commandMatches(
  command: AppCommand,
  query: string,
  getCommandLabel: (command: AppCommand) => string,
): boolean {
  if (!query) {
    return true;
  }

  const haystack = [
    command.label,
    getCommandLabel(command),
    command.group,
    command.shortcut,
    ...(command.keywords ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export function CommandPalette({
  open,
  onOpenChange,
  onReplayOnboarding,
  onToggleTheme,
}: CommandPaletteProps): JSX.Element | null {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useClerk();
  const { resolvedLanguage } = useUiLanguagePreference();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const commandPaletteTitle = translateUi(
    resolvedLanguage,
    "commandPalette.title",
  );
  const emptyStateLabel = translateUi(
    resolvedLanguage,
    "commandPalette.emptyState",
  );
  const searchPlaceholderLabel = translateUi(
    resolvedLanguage,
    "search.placeholder",
  );
  const commandsLabel = translateUi(resolvedLanguage, "menu.commands");
  const getCommandLabel = React.useCallback(
    (command: AppCommand) =>
      command.labelKey
        ? translateUi(resolvedLanguage, command.labelKey)
        : command.label,
    [resolvedLanguage],
  );

  const filteredCommands = React.useMemo(
    () =>
      APP_COMMANDS.filter((command) =>
        commandMatches(command, query, getCommandLabel),
      ),
    [getCommandLabel, query],
  );

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(null);
      return;
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  React.useEffect(() => {
    setActiveIndex(null);
  }, [query]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isCommandK) {
        return;
      }

      event.preventDefault();
      onOpenChange(!open);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  const runCommand = React.useCallback(
    (command: AppCommand) => {
      close();

      if (command.action.type === "navigate") {
        void navigate(command.action.to);
        return;
      }

      if (command.action.type === "quick-start") {
        void navigate(
          {
            pathname: location.pathname,
            search: location.search,
          },
          {
            state: createQuickStartLocationState(location.state, {
              resumeMode:
                command.action.mode === "resume-upload" ? "upload-only" : "choice",
            }),
          },
        );
        return;
      }

      if (command.action.type === "replay-onboarding") {
        onReplayOnboarding();
        return;
      }

      if (command.action.type === "toggle-theme") {
        onToggleTheme();
        return;
      }

      if (command.action.type === "sign-out") {
        void signOut(() => navigate("/sign-in"));
      }
    },
    [
      close,
      location.pathname,
      location.search,
      location.state,
      navigate,
      onReplayOnboarding,
      onToggleTheme,
      signOut,
    ],
  );

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredCommands.length === 0
          ? null
          : current === null
            ? 0
            : (current + 1) % filteredCommands.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredCommands.length === 0
          ? null
          : current === null
            ? filteredCommands.length - 1
            : (current - 1 + filteredCommands.length) % filteredCommands.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex === null) {
        return;
      }
      const command = filteredCommands[activeIndex];
      if (command) {
        runCommand(command);
      }
    }
  };

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="cmdk"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        className="cmdk__panel"
        role="dialog"
        aria-modal="true"
        aria-label={commandPaletteTitle}
        onKeyDown={handlePanelKeyDown}
      >
        <input
          ref={inputRef}
          className="cmdk__input"
          placeholder={searchPlaceholderLabel}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="cmdk__list" role="listbox" aria-label={commandsLabel}>
          {COMMAND_GROUPS.map((group) => {
            const groupCommands = filteredCommands.filter(
              (command) => command.group === group,
            );
            if (groupCommands.length === 0) {
              return null;
            }

            return (
              <section key={group} className="cmdk__group" aria-label={group}>
                <div className="cmdk__group-label">{group}</div>
                {groupCommands.map((command) => {
                  const commandIndex = filteredCommands.indexOf(command);
                  const highlighted = commandIndex === activeIndex;
                  const commandLabel = getCommandLabel(command);
                  return (
                    <button
                      key={command.id}
                      type="button"
                      className="cmdk__item"
                      role="option"
                      aria-selected={highlighted}
                      data-highlighted={highlighted ? "true" : undefined}
                      onMouseEnter={() => setActiveIndex(commandIndex)}
                      onClick={() => runCommand(command)}
                    >
                      <span className="cmdk__item-icon" aria-hidden="true">
                        {commandLabel.slice(0, 1)}
                      </span>
                      <span className="cmdk__item-label">{commandLabel}</span>
                      {command.shortcut ? (
                        <span className="cmdk__item-shortcut" aria-label={command.shortcut}>
                          {command.shortcut.split(" ").map((key) => (
                            <kbd key={`${command.id}-${key}`}>{key}</kbd>
                          ))}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </section>
            );
          })}
          {filteredCommands.length === 0 ? (
            <div className={clsx("cmdk__item", "cmdk__item--empty")}>
              {emptyStateLabel}
            </div>
          ) : null}
        </div>
        <div className="cmdk__hint">
          <span>Up/down navigate</span>
          <span>Enter select</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
