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

const QUICK_START_QUERY_KEYS = {
  trigger: "start",
  createType: "quickStartType",
  resumeMode: "quickStartResumeMode",
  returnTarget: "quickStartReturnTo",
} as const;

export function readQuickStartRouteState(search: string): QuickStartRouteState {
  const params = new URLSearchParams(search);
  const isOpen = params.get(QUICK_START_QUERY_KEYS.trigger) === "quick";
  const createTypeParam = params.get(QUICK_START_QUERY_KEYS.createType);
  const resumeModeParam = params.get(QUICK_START_QUERY_KEYS.resumeMode);
  const returnTargetParam = params.get(QUICK_START_QUERY_KEYS.returnTarget);

  const createType: QuickStartCreateType =
    createTypeParam === "cover-letter" ? "cover-letter" : "resume";
  const resumeMode: QuickStartResumeMode =
    resumeModeParam === "upload-only" ? "upload-only" : "choice";
  const returnTarget: QuickStartReturnTarget =
    returnTargetParam === "proposal" ? "proposal" : null;

  return {
    isOpen,
    createType,
    resumeMode,
    returnTarget,
  };
}

export function clearQuickStartSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete(QUICK_START_QUERY_KEYS.trigger);
  params.delete(QUICK_START_QUERY_KEYS.createType);
  params.delete(QUICK_START_QUERY_KEYS.resumeMode);
  params.delete(QUICK_START_QUERY_KEYS.returnTarget);
  return params.toString();
}

export function buildQuickStartHref(
  pathname: string,
  search: string,
  options: QuickStartRouteOptions = {},
): string {
  const params = new URLSearchParams(clearQuickStartSearch(search));
  params.set(QUICK_START_QUERY_KEYS.trigger, "quick");

  if (options.createType && options.createType !== "resume") {
    params.set(QUICK_START_QUERY_KEYS.createType, options.createType);
  }

  if (options.resumeMode && options.resumeMode !== "choice") {
    params.set(QUICK_START_QUERY_KEYS.resumeMode, options.resumeMode);
  }

  if (options.returnTarget) {
    params.set(QUICK_START_QUERY_KEYS.returnTarget, options.returnTarget);
  }

  const nextSearch = params.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}
