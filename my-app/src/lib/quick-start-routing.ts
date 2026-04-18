export type QuickStartCreateType = "resume" | "cover-letter";
export type QuickStartResumeMode = "choice" | "upload-only";
export type QuickStartReturnTarget = "proposal" | null;

export type QuickStartRouteState = {
  isOpen: boolean;
  createType: QuickStartCreateType;
  resumeMode: QuickStartResumeMode;
  returnTarget: QuickStartReturnTarget;
};

type QuickStartRouteOptions = {
  createType?: QuickStartCreateType;
  resumeMode?: QuickStartResumeMode;
  returnTarget?: QuickStartReturnTarget;
};

const QUICK_START_LOCATION_STATE_KEY = "quickStart";

function asStateRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function readQuickStartRouteState(value: unknown): QuickStartRouteState {
  const record = asStateRecord(value);
  const quickStartRecord = asStateRecord(
    record?.[QUICK_START_LOCATION_STATE_KEY],
  );

  if (!quickStartRecord) {
    return {
      isOpen: false,
      createType: "resume",
      resumeMode: "choice",
      returnTarget: null,
    };
  }

  return {
    isOpen: true,
    createType:
      quickStartRecord.createType === "cover-letter"
        ? "cover-letter"
        : "resume",
    resumeMode:
      quickStartRecord.resumeMode === "upload-only"
        ? "upload-only"
        : "choice",
    returnTarget:
      quickStartRecord.returnTarget === "proposal" ? "proposal" : null,
  };
}

export function createQuickStartLocationState(
  currentState: unknown,
  options: QuickStartRouteOptions = {},
): Record<string, unknown> {
  const baseState = asStateRecord(currentState) ?? {};

  return {
    ...baseState,
    [QUICK_START_LOCATION_STATE_KEY]: {
      createType: options.createType ?? "resume",
      resumeMode: options.resumeMode ?? "choice",
      returnTarget: options.returnTarget ?? null,
    },
  };
}

export function clearQuickStartLocationState(
  currentState: unknown,
): Record<string, unknown> | null {
  const baseState = asStateRecord(currentState);
  if (!baseState) {
    return null;
  }

  const { [QUICK_START_LOCATION_STATE_KEY]: _ignored, ...nextState } = baseState;
  return Object.keys(nextState).length > 0 ? nextState : null;
}
