import React, { useEffect } from "react";
import { EliteDock } from "./EliteDock";
import { EliteToast } from "./EliteToast";
import { SegmentedPill } from "./SegmentedPill";
import { useActiveJobAnchor } from "./useActiveJobAnchor";
import { useExtensionTheme } from "./useExtensionTheme";
import { useJobForgeCapsuleElite } from "./useJobForgeCapsuleElite";
import "./jobforge-capsule-v3-elite.tokens.css";
import "./jobforge-capsule-v3-elite.css";

export function JobForgeCapsuleRoot() {
  const themeMode = useExtensionTheme();
  const position = useActiveJobAnchor();
  const capsule = useJobForgeCapsuleElite();
  const expanded = capsule.dockVisible;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const root = document.getElementById("tw-jobforge-capsule-root");
      if (!root || root.contains(event.target as Node)) return;
      capsule.setDockVisible(false);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [capsule]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        capsule.setDockVisible(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [capsule]);

  return (
    <div
      id="tw-jobforge-capsule-root"
      data-state={capsule.dockStatus}
      data-visible="true"
      data-expanded={expanded ? "true" : "false"}
      data-theme={themeMode}
      style={{ top: `${position.top}px`, right: `${position.right}px` }}
    >
      <SegmentedPill
        expanded={expanded}
        saveState={capsule.saveState}
        onDraft={capsule.handleDraft}
        onOpen={capsule.handleOpen}
        onSave={capsule.handleSave}
        onTw={capsule.handleTw}
      />
      <EliteToast toast={capsule.toast} />
      <EliteDock
        activeCvSnapshot={capsule.activeCvSnapshot}
        activeCvOptions={capsule.activeCvOptions}
        contextMode={capsule.contextMode}
        generatedProposal={capsule.generatedProposal}
        status={capsule.dockStatus}
        visible={capsule.dockVisible}
        onCopyGenerated={capsule.handleCopyGenerated}
        onExportPdf={capsule.handleExportPdf}
        onGenerate={capsule.handleGenerate}
        onSelectActiveCv={capsule.handleSelectActiveCv}
        onShareGenerated={capsule.handleShareGenerated}
        onSetContext={capsule.setContext}
      />
    </div>
  );
}
