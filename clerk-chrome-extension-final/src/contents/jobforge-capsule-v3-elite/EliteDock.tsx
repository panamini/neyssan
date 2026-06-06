import React, { useEffect, useRef, useState } from "react";
import { GeneratedText } from "./GeneratedText";
import type { ActiveCvOption, ActiveCvSnapshot, ContextMode, DockStatus, GeneratedProposalState } from "./types";

interface EliteDockProps {
  activeCvSnapshot: ActiveCvSnapshot | null;
  activeCvOptions: ActiveCvOption[];
  contextMode: ContextMode;
  generatedProposal: GeneratedProposalState | null;
  status: DockStatus;
  visible: boolean;
  onCopyGenerated: () => void;
  onExportPdf: () => void;
  onGenerate: () => void;
  onSelectActiveCv: (profileId: string) => void;
  onShareGenerated: () => void;
  onSetContext: (mode: ContextMode) => void;
  selectedActiveCvProfileId: string | null;
}

function statusLabel(status: DockStatus) {
  if (status === "saving") return "saving";
  if (status === "generating") return "running";
  if (status === "generated") return "complete";
  if (status === "error") return "fault";
  return "synced";
}

function searchNameForOption(option: ActiveCvOption) {
  return [option.title, option.subtitle, option.personalizationContext?.name, option.personalizationContext?.summary]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

export function EliteDock({
  activeCvSnapshot,
  activeCvOptions,
  contextMode,
  generatedProposal,
  status,
  visible,
  onCopyGenerated,
  onExportPdf,
  onGenerate,
  onSelectActiveCv,
  onShareGenerated,
  onSetContext,
  selectedActiveCvProfileId,
}: EliteDockProps) {
  const activeCvLabel = activeCvSnapshot?.title || "Current active CV";
  const canUseActiveCv = Boolean(activeCvSnapshot);
  const isBusy = status === "saving" || status === "generating";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const scrollFrameRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activeProfileDisplayRef = useRef<HTMLSpanElement | null>(null);

  const closeDrawer = () => {
    setDrawerOpen(false);
    if (searchRef.current) {
      searchRef.current.value = "";
    }
    if (scrollFrameRef.current) {
      scrollFrameRef.current
        .querySelectorAll<HTMLElement>(".tw-vault-row")
        .forEach((row) => {
          row.style.display = "flex";
        });
      const empty = scrollFrameRef.current.querySelector<HTMLElement>(".tw-vault-empty");
      if (empty) empty.style.display = "none";
    }
  };

  useEffect(() => {
    const search = searchRef.current;
    const frame = scrollFrameRef.current;
    if (!search || !frame) return undefined;

    const handleInput = () => {
      const query = search.value.toLowerCase().trim();
      const rows = Array.from(frame.querySelectorAll<HTMLElement>(".tw-vault-row"));
      let visibleCount = 0;

      rows.forEach((row) => {
        const searchName = row.dataset.searchname ?? "";
        const matches = searchName.includes(query);
        row.style.display = matches ? "flex" : "none";
        if (matches) visibleCount += 1;
      });

      const empty = frame.querySelector<HTMLElement>(".tw-vault-empty");
      if (empty) empty.style.display = visibleCount === 0 ? "block" : "none";
    };

    const handleRowClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest<HTMLElement>(".tw-vault-row");
      const profileId = row?.dataset.profileid;
      if (!row || !profileId) return;

      const profileName = row.querySelector<HTMLElement>(".tw-vault-filename")?.innerText.trim();
      const profileDescription = row.querySelector<HTMLElement>(".tw-vault-description")?.innerText.trim();
      if (profileName && activeProfileDisplayRef.current) {
        activeProfileDisplayRef.current.innerText = profileDescription
          ? `${profileName} - ${profileDescription.slice(0, 18)}...`
          : profileName;
      }

      onSelectActiveCv(profileId);
      closeDrawer();
    };

    search.addEventListener("input", handleInput);
    frame.addEventListener("click", handleRowClick);
    return () => {
      search.removeEventListener("input", handleInput);
      frame.removeEventListener("click", handleRowClick);
    };
  }, [onSelectActiveCv]);

  useEffect(() => {
    if (visible) return;
    closeDrawer();
  }, [visible]);

  useEffect(() => {
    if (!drawerOpen) return;
    searchRef.current?.focus();
  }, [drawerOpen]);

  return (
    <div className="tw-dock" data-visible={visible ? "true" : "false"} aria-hidden={visible ? "false" : "true"}>
      <div className="tw-dock-header">
        <div className="tw-dock-title">tw // generator-engine</div>
        <div className="tw-status-dot">{statusLabel(status)}</div>
      </div>

      <div className="tw-context-group" role="radiogroup" aria-label="Proposal context">
        <label className="tw-context-item" data-disabled={!canUseActiveCv ? "true" : "false"}>
          <span id="activeProfileDisplay" ref={activeProfileDisplayRef}>{activeCvLabel}</span>
          <input
            type="radio"
            name="tw_jobforge_context"
            checked={contextMode === "active-cv"}
            disabled={!canUseActiveCv}
            onChange={() => onSetContext("active-cv")}
          />
          <span className="tw-radio-marker" />
        </label>
        <div className="tw-cv-attach">
          <button
            className="tw-cv-attach-label"
            type="button"
            ref={triggerRef}
            data-active={drawerOpen ? "true" : "false"}
            onClick={(event) => {
              event.stopPropagation();
              setDrawerOpen((current) => !current);
            }}
          >
            <span className="tw-cv-attach-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M8.5 12.5 15.5 5.5a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a5 5 0 1 1-7.07-7.07l9.19-9.19" />
              </svg>
            </span>
            <span>Attach CV from app vault...</span>
          </button>
          <div
            className="tw-vault-drawer"
            ref={drawerRef}
            data-visible={drawerOpen ? "true" : "false"}
            aria-hidden={drawerOpen ? "false" : "true"}
          >
            <div className="tw-drawer-search-wrapper">
              <input
                className="tw-drawer-search"
                type="text"
                ref={searchRef}
                placeholder="Filter profiles..."
                autoComplete="off"
              />
            </div>
            <div className="tw-vault-scroll-frame" ref={scrollFrameRef} role="listbox" aria-label="App vault CVs">
              {activeCvOptions.map((option) => {
                const selected = option.profileId === selectedActiveCvProfileId;
                return (
                  <button
                    key={option.profileId}
                    className="tw-vault-row"
                    type="button"
                    aria-pressed={selected ? "true" : "false"}
                    data-selected={selected ? "true" : "false"}
                    data-profileid={option.profileId}
                    data-searchname={searchNameForOption(option)}
                  >
                    <span className="tw-vault-row-meta">
                      <span className="tw-vault-filename">{option.title}</span>
                      {option.subtitle ? <span className="tw-vault-description">{option.subtitle}</span> : null}
                    </span>
                    <span className="tw-vault-badge">APP VAULT</span>
                  </button>
                );
              })}
              {activeCvOptions.length > 0 ? <div className="tw-vault-empty">no matching records</div> : null}
              {activeCvOptions.length === 0 ? <div className="tw-vault-empty-static">No CVs in app vault yet.</div> : null}
            </div>
          </div>
        </div>
        <label className="tw-context-item">
          <span>Raw Job Specification Only</span>
          <input
            type="radio"
            name="tw_jobforge_context"
            checked={contextMode === "raw-job"}
            onChange={() => onSetContext("raw-job")}
          />
          <span className="tw-radio-marker" />
        </label>
      </div>

      <button className="tw-action-btn" type="button" onClick={onGenerate} disabled={isBusy}>
        {status === "generating" ? "executing_generation_routine..." : generatedProposal ? "Regenerate Proposal" : "Create Proposal"}
      </button>

      {generatedProposal ? (
        <GeneratedText
          generatedProposal={generatedProposal}
          onCopy={onCopyGenerated}
          onExportPdf={onExportPdf}
          onShare={onShareGenerated}
        />
      ) : null}
    </div>
  );
}
