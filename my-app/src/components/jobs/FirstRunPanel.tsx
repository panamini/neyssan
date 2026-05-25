import React from "react";
import { useMutation } from "convex/react";
import { NewspaperClipping } from "@/lib/icons";
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
    <div className="dasti-jobs-empty-state">
      <section className="onb-replay__pane">
        <div className="dasti-jobs-empty-state__icon-slot" aria-hidden="true">
          <NewspaperClipping size={34} strokeWidth={1.25} />
        </div>
        <h2 className="onb-replay__title">Start with one job.</h2>
        <p className="onb-replay__copy">Import a role. Or try a sample.</p>
        <div className="onb-replay__choices">
          <button
            type="button"
            className="onb-replay__choice"
            data-primary="true"
            onClick={() => {
              selectedPathRef.current = "import";
              void recordFirstRunPath({ path: "import" }).catch(() => {});
              onImportFirstJob();
            }}
          >
            <span className="onb-replay__choice-title">Add a job</span>
            <span className="onb-replay__choice-desc">
              Capture a role with the extension.
            </span>
          </button>
          <button
            type="button"
            className="onb-replay__choice"
            disabled={isSeedingSample}
            onClick={() => {
              selectedPathRef.current = "sample";
              void onTrySampleJob();
            }}
          >
            <span className="onb-replay__choice-title">
              {isSeedingSample ? "Loading sample" : "Try a sample"}
            </span>
            <span className="onb-replay__choice-desc">
              Load an example role.
            </span>
          </button>
        </div>
      </section>
      {errorMessage ? (
        <p className="dasti-empty-state__subtitle" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
