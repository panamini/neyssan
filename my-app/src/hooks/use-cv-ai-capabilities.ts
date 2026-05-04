import React from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";

export const CV_AI_STALE_MESSAGE =
  "CV AI needs a backend refresh. Restart `npx convex dev` or reload after `npx convex codegen`.";

export const CV_AI_ACTION_IDS = [
  "rewrite_summary_from_profile",
  "improve_summary_text",
  "generate_skills_suggestions",
  "generate_skills_from_experience",
  "generate_language_suggestions",
  "generate_hobby_suggestions",
  "improve_experience_responsibilities",
  "improve_experience_bullets",
  "improve_project_description",
  "fix_education_entry",
  "improve_achievement_line",
  "improve_custom_text",
] as const;

export type CvAiActionId = (typeof CV_AI_ACTION_IDS)[number];

const LEGACY_RUNTIME_ACTION_IDS = [
  "rewrite_summary_from_profile",
  "improve_summary_text",
  "generate_skills_from_experience",
  "improve_experience_responsibilities",
  "improve_experience_bullets",
] as const satisfies readonly CvAiActionId[];

type CvAiCapabilitiesResponse = {
  version?: string;
  supportedActions?: string[];
} | null;

type CvAiCapabilitiesState = {
  status: "loading" | "ready" | "stale";
  version: string | null;
  supportedActions: CvAiActionId[];
};

function normalizeSupportedActions(
  supportedActions: string[] | undefined,
): CvAiActionId[] {
  const supportedSet = new Set(supportedActions ?? []);
  return CV_AI_ACTION_IDS.filter((actionId) => supportedSet.has(actionId));
}

export function useCvAiCapabilities() {
  const convex = useConvex();
  const [state, setState] = React.useState<CvAiCapabilitiesState>({
    status: "loading",
    version: null,
    supportedActions: [...LEGACY_RUNTIME_ACTION_IDS],
  });

  React.useEffect(() => {
    let cancelled = false;

    void convex
      .query((api.functions as any).getCvAiCapabilities, {})
      .then((result) => {
        if (cancelled) {
          return;
        }

        const payload = result as CvAiCapabilitiesResponse;
        setState({
          status: "ready",
          version:
            typeof payload?.version === "string" ? payload.version : null,
          supportedActions: normalizeSupportedActions(payload?.supportedActions),
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.warn("[CV AI] capabilities query unavailable", error);
        setState({
          status: "stale",
          version: null,
          supportedActions: [...LEGACY_RUNTIME_ACTION_IDS],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [convex]);

  const supportedActionSet = React.useMemo(
    () => new Set(state.supportedActions),
    [state.supportedActions],
  );

  const isSupported = React.useCallback(
    (actionId: CvAiActionId) => supportedActionSet.has(actionId),
    [supportedActionSet],
  );

  return {
    ...state,
    isSupported,
    staleMessage: CV_AI_STALE_MESSAGE,
  };
}
