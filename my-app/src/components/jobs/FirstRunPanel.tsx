/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-member-access -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React from "react";
import { useMutation } from "convex/react";
import { NewspaperClipping } from "@/lib/icons";
import { api } from "../../../convex/_generated/api";
import { translateUi } from "../../lib/i18n";
import { useUiLanguagePreference } from "../../lib/ui-preferences";

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
  const { resolvedLanguage } = useUiLanguagePreference();
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
        <h2 className="onb-replay__title">
          {translateUi(resolvedLanguage, "jobs.startWithOne")}
        </h2>
        <p className="onb-replay__copy">
          {translateUi(resolvedLanguage, "jobs.startWithOneHelp")}
        </p>
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
            <span className="onb-replay__choice-title">
              {translateUi(resolvedLanguage, "jobs.addAJob")}
            </span>
            <span className="onb-replay__choice-desc">
              {translateUi(resolvedLanguage, "jobs.captureWithExtension")}
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
              {isSeedingSample
                ? translateUi(resolvedLanguage, "jobs.loadingSample")
                : translateUi(resolvedLanguage, "jobs.trySample")}
            </span>
            <span className="onb-replay__choice-desc">
              {translateUi(resolvedLanguage, "jobs.loadExampleRole")}
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
