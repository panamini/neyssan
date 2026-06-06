import type { ActiveCvOption, ActiveCvSnapshot, JobData } from "./types";

function runtimeErrorMessage() {
  return chrome.runtime.lastError?.message || "Could not reach the extension background process.";
}

export function sendRuntimeMessage<TResponse>(
  message: Record<string, unknown>,
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(runtimeErrorMessage()));
        return;
      }
      resolve(response as TResponse);
    });
  });
}

export async function checkSession() {
  return sendRuntimeMessage<{
    success: boolean;
    signedIn: boolean;
    error?: string;
  }>({ action: "checkSession", reason: "jobforge-capsule-mount" });
}

export async function getActiveCvSnapshot() {
  return sendRuntimeMessage<{
    success: boolean;
    snapshot?: ActiveCvSnapshot | null;
    error?: string;
  }>({ action: "getActiveCvSnapshot" });
}

export async function listActiveCvOptions() {
  return sendRuntimeMessage<{
    success: boolean;
    options?: ActiveCvOption[];
    error?: string;
  }>({ action: "listActiveCvOptions" });
}

export async function setActiveCvFromProfile(profileId: string) {
  return sendRuntimeMessage<{
    success: boolean;
    snapshot?: ActiveCvSnapshot | null;
    error?: string;
  }>({ action: "setActiveCvFromProfile", profileId });
}

export async function saveJob(jobData: JobData) {
  return sendRuntimeMessage<{
    success: boolean;
    jobId?: string;
    dedupeHit?: boolean;
    parseStatus?: string;
    reviewState?: string;
    error?: string;
  }>({ action: "saveJob", jobData });
}

export async function getJobSaveState(jobData: JobData) {
  return sendRuntimeMessage<{
    success: boolean;
    jobId?: string;
    parseStatus?: string;
    reviewState?: string;
    error?: string;
  }>({ action: "getJobSaveState", jobData });
}

export async function generateProposal(jobData: JobData, useCurrentCvContext: boolean) {
  return sendRuntimeMessage<{
    success: boolean;
    proposal?: string;
    proposalId?: string;
    actualModelType?: string;
    actualModelName?: string;
    routing?: {
      attemptedPath?: string | null;
      plannedPath?: string | null;
      executedPath?: string | null;
      fallbackReason?: string | null;
      validatorOutcome?: string | null;
      saveOutcome?: string | null;
    };
    error?: string;
  }>({ action: "generateProposal", jobData, useCurrentCvContext });
}

export async function openProposalForge(jobData: JobData) {
  return sendRuntimeMessage<{
    success: boolean;
    jobId?: string;
    dedupeHit?: boolean;
    error?: string;
  }>({ action: "openProposalForge", jobData });
}
