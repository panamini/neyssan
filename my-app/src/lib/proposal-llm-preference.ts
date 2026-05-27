import React from "react";

export const PROPOSAL_LLM_MODEL_OPTIONS = [
  { value: "chatgpt", label: "GPT-5.5" },
  { value: "qwen3.7-max", label: "Qwen3.7-Max" },
  { value: "mistral-medium-latest", label: "Mistral Medium" },
  { value: "mistral-large-latest", label: "Mistral Large" },
] as const;

export const PROPOSAL_LLM_MODEL_VALUES = [
  "chatgpt",
  "qwen3.7-max",
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "mistral-agent",
] as const;

export type ProposalLlmModelType = (typeof PROPOSAL_LLM_MODEL_VALUES)[number];

const DEFAULT_PROPOSAL_LLM_MODEL: ProposalLlmModelType = "mistral-medium-latest";
const PROPOSAL_LLM_MODEL_STORAGE_KEY = "twoweeks:proposal-llm-model";
const PROPOSAL_LLM_MODEL_CHANGE_EVENT = "twoweeks:proposal-llm-model-change";

export function isProposalLlmModelType(
  value: unknown,
): value is ProposalLlmModelType {
  return PROPOSAL_LLM_MODEL_VALUES.includes(value as ProposalLlmModelType);
}

export function readStoredProposalLlmModel(): ProposalLlmModelType {
  if (typeof window === "undefined") {
    return DEFAULT_PROPOSAL_LLM_MODEL;
  }

  try {
    const value = window.localStorage.getItem(PROPOSAL_LLM_MODEL_STORAGE_KEY);
    return isProposalLlmModelType(value) ? value : DEFAULT_PROPOSAL_LLM_MODEL;
  } catch {
    return DEFAULT_PROPOSAL_LLM_MODEL;
  }
}

function subscribeProposalLlmModel(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === PROPOSAL_LLM_MODEL_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(PROPOSAL_LLM_MODEL_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PROPOSAL_LLM_MODEL_CHANGE_EVENT, onStoreChange);
  };
}

export function setStoredProposalLlmModel(model: ProposalLlmModelType): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PROPOSAL_LLM_MODEL_STORAGE_KEY, model);
  } catch {
    /* noop */
  }

  window.dispatchEvent(new CustomEvent(PROPOSAL_LLM_MODEL_CHANGE_EVENT));
}

export function useProposalLlmModelPreference(): {
  model: ProposalLlmModelType;
  setModel: (model: ProposalLlmModelType) => void;
} {
  const model = React.useSyncExternalStore(
    subscribeProposalLlmModel,
    readStoredProposalLlmModel,
    () => DEFAULT_PROPOSAL_LLM_MODEL,
  );

  const setModel = React.useCallback((nextModel: ProposalLlmModelType) => {
    setStoredProposalLlmModel(nextModel);
  }, []);

  return { model, setModel };
}
