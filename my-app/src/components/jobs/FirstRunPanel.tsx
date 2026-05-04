import React from "react";
import { useMutation } from "convex/react";
import { ClipboardText } from "@/lib/icons";
import { api } from "../../../convex/_generated/api";

type FirstRunPanelProps = {
  onImportFirstJob: () => void;
  onTrySampleJob: () => void | Promise<void>;
  isSeedingSample?: boolean;
  errorMessage?: string | null;
};

export function FirstRunPanel({
  onImportFirstJob,
  onTrySampleJob,
  isSeedingSample = false,
  errorMessage = null,
}: FirstRunPanelProps): JSX.Element {
  const recordFirstRunPath = useMutation(
    ((api as any).jobsPublic?.recordFirstRunPath ??
      "jobsPublic.recordFirstRunPath") as any,
  );
  const selectedPathRef = React.useRef<"import" | "sample" | null>(null);

  React.useEffect(
    () => () => {
      if (selectedPathRef.current !== null) {
        return;
      }

      void recordFirstRunPath({ path: "bounce" }).catch(() => {});
    },
    [recordFirstRunPath],
  );

  return (
    <div className="dasti-empty-state dasti-jobs-empty-state">
      <ClipboardText size={34} strokeWidth={1.25} aria-hidden="true" />
      <div className="dasti-empty-state__title">Start with one job.</div>
      <p className="dasti-empty-state__subtitle">
        Import a role. Or try a sample.
      </p>
      <div className="dasti-jobs-empty-state__actions">
        <button
          type="button"
          className="dasti-button dasti-button--primary dasti-button--pill"
          onClick={() => {
            selectedPathRef.current = "import";
            void recordFirstRunPath({ path: "import" }).catch(() => {});
            onImportFirstJob();
          }}
        >
          <span>Import job</span>
          <span className="ds-btn__period" aria-hidden="true">.</span>
        </button>
        <button
          type="button"
          className="dasti-button dasti-button--pill"
          disabled={isSeedingSample}
          onClick={() => {
            selectedPathRef.current = "sample";
            void onTrySampleJob();
          }}
        >
          {isSeedingSample ? "Loading sample" : "Try a sample"}
        </button>
      </div>
      {errorMessage ? (
        <p className="dasti-empty-state__subtitle" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
