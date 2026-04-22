import { ConvexHttpClient } from "convex/browser";
import { createClerkClient } from "@clerk/chrome-extension/background";
import { api } from "../../convex/_generated/api";
import { buildAppUrl, resolveAppBaseUrl, resolveSyncHost } from "../lib/app-base-url";
import { isUsableAuthToken } from "../lib/auth-token";
import {
  resolveExtensionGenerateModelType,
  type ExtensionModelType,
  type ExtensionProposalType
} from "./generateModelType";
import {
  readExtensionAuthSnapshot,
  writeClearedExtensionAuthState,
  writeSignedInExtensionAuthState
} from "../lib/extension-auth-state";

const FALLBACK_CONVEX_URL = "https://neat-starfish-33.convex.cloud";

function resolveConvexUrl(): string {
  const explicitUrl = (process.env.PLASMO_PUBLIC_CONVEX_URL ?? "").trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const deployment = (process.env.CONVEX_DEPLOYMENT ?? "").trim();
  if (deployment.includes(":")) {
    const [, slug] = deployment.split(":", 2);
    if (slug) {
      return `https://${slug}.convex.cloud`;
    }
  }

  console.warn(
    "[clerk-sync][background] Missing PLASMO_PUBLIC_CONVEX_URL and CONVEX_DEPLOYMENT, using fallback Convex URL.",
  );
  return FALLBACK_CONVEX_URL;
}

const CONVEX_URL = resolveConvexUrl();
const convex = new ConvexHttpClient(CONVEX_URL);
let currentToken: string | null = null;
const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const CLERK_FRONTEND_API =
  process.env.CLERK_FRONTEND_API ?? process.env.PLASMO_PUBLIC_CLERK_FRONTEND_API ?? "";
const SYNC_HOST = resolveSyncHost(process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST ?? "");
const APP_BASE_URL = resolveAppBaseUrl(
  process.env.PLASMO_PUBLIC_APP_BASE_URL ?? process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST ?? ""
);
const AUTH_DEBUG_PREFIX = "[clerk-sync][background]";

type SessionSyncResult = {
  signedIn: boolean;
  token?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  error?: string;
};

function logAuthDebug(event: string, details: Record<string, unknown> = {}) {
  console.info(AUTH_DEBUG_PREFIX, event, details);
}

async function getBackgroundClerk() {
  if (!PUBLISHABLE_KEY) {
    throw new Error("Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY");
  }

  logAuthDebug("create-clerk-client", {
    syncHost: SYNC_HOST || null,
    hasPublishableKey: Boolean(PUBLISHABLE_KEY),
    hasFrontendApi: Boolean(CLERK_FRONTEND_API)
  });

  return createClerkClient({
    publishableKey: PUBLISHABLE_KEY,
    syncHost: SYNC_HOST || undefined
  });
}

async function clearStoredExtensionAuth(reason: string) {
  await writeClearedExtensionAuthState(reason);
}

async function readStoredExtensionAuth(): Promise<{
  token: string | null;
  userName: string | null;
  userEmail: string | null;
}> {
  const snapshot = await readExtensionAuthSnapshot();
  return {
    token: snapshot.authToken,
    userName: snapshot.userName,
    userEmail: snapshot.userEmail
  };
}

async function resetExtensionAuthState(reason: string) {
  currentToken = null;
  convex.setAuth("");
  logAuthDebug("convex-auth-cleared", { reason });
  await clearStoredExtensionAuth(reason);
}

async function syncSessionFromClerk(): Promise<SessionSyncResult> {
  const storedAuth = await readStoredExtensionAuth();

  try {
    logAuthDebug("session-sync-start", {
      syncHost: SYNC_HOST || null,
      hasStoredToken: Boolean(storedAuth.token)
    });

    const clerk = await getBackgroundClerk();
    const session = clerk.session ?? null;

    logAuthDebug("clerk-session-state", {
      recoveredSession: Boolean(session),
      sessionId: session?.id ?? null
    });

    if (!session) {
      await resetExtensionAuthState("no-clerk-session");
      return { signedIn: false };
    }

    const token = await session.getToken({ template: "convex" });
    const hasConvexToken = isUsableAuthToken(token);

    logAuthDebug("clerk-token-state", {
      recoveredSession: true,
      hasConvexToken
    });

    if (!hasConvexToken) {
      await resetExtensionAuthState("missing-convex-token");
      return {
        signedIn: false,
        error: "No usable Convex token returned from Clerk."
      };
    }

    const user = clerk.user ?? null;
    const userName =
      (user
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || user.id
        : null) || null;
    const userEmail =
      user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || null;

    currentToken = token;
    convex.setAuth(currentToken ?? "");
    logAuthDebug("convex-auth-ready", { hasConvexToken: true });

    await writeSignedInExtensionAuthState(currentToken, userName, userEmail, "clerk-sync-success");

    return {
      signedIn: Boolean(currentToken),
      token: currentToken,
      userName,
      userEmail
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown Clerk sync error";
    console.error("Failed to sync Clerk session in background:", error);
    await resetExtensionAuthState("clerk-sync-error");

    logAuthDebug("clerk-sync-error", { error: errorMessage });
    return {
      signedIn: false,
      error: errorMessage
    };
  }
}

async function requireCurrentSessionToken(): Promise<string> {
  const result = await syncSessionFromClerk();
  if (result.token) {
    return result.token;
  }

  throw new Error(result.error || "No auth token available after session sync");
}

async function performBackgroundSessionSync(trigger: string) {
  const result = await syncSessionFromClerk();
  currentToken = result.token || null;
  convex.setAuth(currentToken ?? "");
  logAuthDebug("background-session-sync", {
    trigger,
    signedIn: result.signedIn,
    hasConvexToken: Boolean(currentToken),
    hasError: Boolean(result.error)
  });
  return result;
}

(async () => {
  logAuthDebug("background-init", {
    syncHost: SYNC_HOST || null,
    appBaseUrl: APP_BASE_URL,
    extensionOrigin: chrome.runtime.getURL("").replace(/\/$/, ""),
    convexUrl: CONVEX_URL
  });
  const result = await performBackgroundSessionSync("initial-load");
  logAuthDebug("initial-convex-token-state", { hasConvexToken: Boolean(result.token) });
})();

setInterval(async () => {
  const result = await performBackgroundSessionSync("periodic-interval");
  logAuthDebug("periodic-session-sync", {
    signedIn: result.signedIn,
    hasConvexToken: Boolean(currentToken)
  });
}, 60 * 1000);

interface JobData {
  platform: string;
  title: string;
  description?: string;
  url: string;
  jobId?: string;
  proposalType?: ExtensionProposalType;
  formalityLevel?: "informal" | "formal" | "neutral";
  creativity?: "low" | "medium" | "high";
  modelType?: ExtensionModelType;
}

interface ActiveCvSnapshot {
  title: string;
  personalizationContext: {
    name?: string;
    summary?: string;
    desiredPosition?: string;
    topSkills?: string[];
    recentExperience?: Array<{
      company?: string;
      position?: string;
      highlights?: string[];
    }>;
    standoutAchievements?: string[];
  } | null;
  updatedAt?: string;
}

interface Message {
  action:
    | "generateProposal"
    | "saveJob"
    | "getJobSaveState"
    | "saveProposal"
    | "ingestProfile"
    | "openProposalForge"
    | "checkSession"
    | "getActiveCvSnapshot";
  jobData?: JobData;
  proposalText?: string;
  useCurrentCvContext?: boolean;
  // profile payload for ingestProfile action
  profile?: {
    summary?: string;
    skills?: string[];
    experience?: Array<{
      company?: string;
      title?: string;
      startDate?: number;
      endDate?: number;
      description?: string;
    }>;
    education?: Array<{
      school?: string;
      degree?: string;
      fieldOfStudy?: string;
      startDate?: number;
      endDate?: number;
    }>;
  };
}

  chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  switch (message.action) {
    case "generateProposal":
      generateProposalHandler(message, sendResponse);
      return true;
    case "saveJob":
      saveJobHandler(message, sendResponse);
      return true;
    case "getJobSaveState":
      getJobSaveStateHandler(message, sendResponse);
      return true;
    case "saveProposal":
      saveProposalHandler(message, sendResponse);
      return true;
    case "ingestProfile":
      // message.profile expected
      ingestProfileHandler(message.profile, sendResponse);
      return true;
    case "openProposalForge":
      openProposalForgeHandler(message, sendResponse);
      return true;
    case "checkSession":
      void checkSessionHandler(sendResponse);
      return true;
    case "getActiveCvSnapshot":
      void getActiveCvSnapshotHandler(sendResponse);
      return true;
    default:
      console.warn("Unknown action:", message.action);
      return false;
  }
});

async function fetchCurrentActiveCvSnapshot(): Promise<ActiveCvSnapshot | null> {
  const result = await performBackgroundSessionSync("active-cv-snapshot");
  currentToken = result.token || null;
  convex.setAuth(currentToken ?? "");

  if (!currentToken) {
    return null;
  }

  const snapshot = await convex.query((api as any).activeCvSnapshots.getCurrent, {});
  return snapshot ?? null;
}

async function generateProposalHandler(
  message: Message,
  sendResponse: (response: { success: boolean; proposal?: string; error?: string }) => void
) {
  try {
    currentToken = await requireCurrentSessionToken();
    convex.setAuth(currentToken ?? "");
    logAuthDebug("generate-proposal-auth", { hasConvexToken: Boolean(currentToken) });

    let activeCvSnapshot: ActiveCvSnapshot | null = null;
    if (message.useCurrentCvContext) {
      activeCvSnapshot = await convex.query((api as any).activeCvSnapshots.getCurrent, {});
    }

    // Call the generateProposal function via Convex HTTP client (action)
    console.log("Calling function generateProposal via action");
    const proposalType = message.jobData?.proposalType || "cover_letter";
    const modelType = resolveExtensionGenerateModelType({
      requestedModelType: message.jobData?.modelType,
      proposalType,
      useCurrentCvContext: message.useCurrentCvContext,
    });
    const generateArgs: Record<string, unknown> = {
      jobTitle: message.jobData!.title,
      jobDescription: message.jobData!.description || "No description provided",
      proposalType,
      modelType,
    };

    if (message.jobData?.formalityLevel) {
      generateArgs.formalityLevel = message.jobData.formalityLevel;
    }
    if (message.jobData?.creativity) {
      generateArgs.creativity = message.jobData.creativity;
    }
    if (message.jobData?.jobId) {
      generateArgs.jobId = message.jobData.jobId;
    }

    if (!message.useCurrentCvContext) {
      generateArgs.personalizationMode = "explicit_only";
    } else if (activeCvSnapshot?.personalizationContext) {
      generateArgs.personalizationContext = activeCvSnapshot.personalizationContext;
      generateArgs.personalizationMode = "explicit_only";
    }

    const result = await convex.action(api.functions.generateProposal, generateArgs);
    console.log("Action result:", result);
    sendResponse({ success: true, proposal: result.proposalContent });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Generate proposal error:", errorMessage, error);
    sendResponse({ success: false, error: errorMessage });
  }
}

async function getActiveCvSnapshotHandler(
  sendResponse: (response: { success: boolean; snapshot?: ActiveCvSnapshot | null; error?: string }) => void
) {
  try {
    const snapshot = await fetchCurrentActiveCvSnapshot();
    sendResponse({ success: true, snapshot });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get active CV snapshot error:", errorMessage, error);
    sendResponse({ success: false, error: errorMessage });
  }
}

async function saveProposalHandler(
  message: Message,
  sendResponse: (response: { success: boolean; error?: string }) => void
) {
  try {
    currentToken = await requireCurrentSessionToken();
    convex.setAuth(currentToken ?? "");
    logAuthDebug("save-proposal-auth", { hasConvexToken: Boolean(currentToken) });
    console.log("Calling mutation:", api.saveJobAndProposal.default._name);
    await convex.mutation(api.saveJobAndProposal.default, {
      jobData: message.jobData!,
      proposalText: message.proposalText || "",
    });
    console.log("Proposal saved successfully");
    sendResponse({ success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Save proposal error:", errorMessage, error);
    sendResponse({ success: false, error: errorMessage });
  }
}

async function saveJobHandler(
  message: Message,
  sendResponse: (response: {
    success: boolean;
    jobId?: string;
    dedupeHit?: boolean;
    parseStatus?: string;
    reviewState?: string;
    error?: string;
  }) => void,
) {
  try {
    currentToken = await requireCurrentSessionToken();
    convex.setAuth(currentToken ?? "");

    const jobData = message.jobData;
    if (!jobData?.title || !jobData?.url) {
      throw new Error("Missing job data for canonical save");
    }

    const result = await convex.mutation(
      (api as any).jobsPublic.createOrReuseFromSource,
      {
        title: jobData.title,
        rawDescription: jobData.description || "",
        sourceUrl: jobData.url,
        sourceType: jobData.platform || "manual",
        applicationUrl: jobData.url,
      },
    );

    sendResponse({
      success: true,
      jobId: result.jobId,
      dedupeHit: result.dedupeHit,
      parseStatus: result.parseStatus,
      reviewState: result.reviewState,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Save job error:", errorMessage, error);
    sendResponse({ success: false, error: errorMessage });
  }
}

async function getJobSaveStateHandler(
  message: Message,
  sendResponse: (response: {
    success: boolean;
    jobId?: string;
    parseStatus?: string;
    reviewState?: string;
    error?: string;
  }) => void,
) {
  try {
    currentToken = await requireCurrentSessionToken();
    convex.setAuth(currentToken ?? "");

    const jobId = message.jobData?.jobId;
    if (!jobId) {
      throw new Error("Missing jobId for job state lookup");
    }

    const job = await convex.query((api as any).jobsPublic.getById, { jobId });
    if (!job) {
      throw new Error("Saved job not found");
    }

    sendResponse({
      success: true,
      jobId,
      parseStatus: job.parseStatus,
      reviewState: job.reviewState,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get job save state error:", errorMessage, error);
    sendResponse({ success: false, error: errorMessage });
  }
}

async function openProposalForgeHandler(
  message: Message,
  sendResponse: (response: {
    success: boolean;
    jobId?: string;
    dedupeHit?: boolean;
    error?: string;
  }) => void
) {
  try {
    currentToken = await requireCurrentSessionToken();

    const jobData = message.jobData;
    if (!jobData?.title || !jobData?.url) {
      throw new Error("Missing job data for Proposal Forge handoff");
    }

    convex.setAuth(currentToken ?? "");
    const saveResult = jobData.jobId
      ? {
          jobId: jobData.jobId,
          dedupeHit: true,
        }
      : await convex.mutation((api as any).jobsPublic.createOrReuseFromSource, {
          title: jobData.title,
          rawDescription: jobData.description || "",
          sourceUrl: jobData.url,
          sourceType: jobData.platform || "manual",
          applicationUrl: jobData.url,
        });

    const handoffResult = await convex.mutation(
      ((api as any).proposalHandoffs?.create ?? "proposalHandoffs.create") as any,
      {
        jobTitle: jobData.title,
        jobDescription: jobData.description || "",
        sourceUrl: jobData.url,
        platform: jobData.platform || "manual",
      },
    );

    const params = new URLSearchParams({
      jobId: saveResult.jobId,
      handoffId: handoffResult.handoffId,
      handoffToken: handoffResult.handoffToken,
    });
    const url = `${buildAppUrl("/proposal", APP_BASE_URL)}?${params.toString()}`;
    chrome.tabs.create({ url });
    sendResponse({
      success: true,
      jobId: saveResult.jobId,
      dedupeHit: Boolean(saveResult.dedupeHit),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Open Proposal Forge error:", errorMessage, error);
    sendResponse({ success: false, error: errorMessage });
  }
}

async function checkSessionHandler(
  sendResponse: (response: { success: boolean; signedIn: boolean; token?: string | null; userName?: string | null; userEmail?: string | null; error?: string }) => void
) {
  try {
    const result = await performBackgroundSessionSync("popup-check-session");
    sendResponse({
      success: !result.error,
      signedIn: result.signedIn,
      token: result.token,
      userName: result.userName,
      userEmail: result.userEmail,
      ...(result.error ? { error: result.error } : {})
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unexpected background session check error";
    logAuthDebug("check-session-handler-error", { error: errorMessage });
    sendResponse({
      success: false,
      signedIn: false,
      error: errorMessage
    });
  }
}

/**
 * Ingest profile handler
 * Receives a profile payload from the content script and forwards it to the
 * Convex HTTP ingestion endpoint using the stored auth token.
 */
async function ingestProfileHandler(
  profile: any,
  sendResponse: (response: { success: boolean; error?: string; detail?: any }) => void
) {
  try {
    currentToken = await requireCurrentSessionToken();
    // Primary: call public mutation profilesPublic if available (preferred; avoids HTTP route issues)
    try {
      convex.setAuth(currentToken ?? "");
      if ((api as any).profilesPublic && (api as any).profilesPublic.default) {
        console.log("Calling public mutation: profilesPublic");
        await convex.mutation((api as any).profilesPublic.default, { profile });
        console.log("Public mutation profilesPublic succeeded");
        sendResponse({ success: true, detail: { method: "profilesPublic" } });
        return;
      }
    } catch (mutationErr) {
      console.warn("Public mutation profilesPublic failed:", mutationErr);
      // continue to HTTP fallback below
    }

    // Fallback: attempt HTTP ingest route
    try {
      // Convex HTTP routes are exposed under /api/http/<path>
      const ingestUrl = `${CONVEX_URL.replace(/\/+$/, "")}/api/http/profiles/ingest`;
      const resp = await fetch(ingestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(profile),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => String(resp.status));
        console.error("HTTP ingest failed:", resp.status, text);
        sendResponse({ success: false, error: `HTTP ingest failed: ${resp.status}`, detail: text });
        return;
      }
      const data = await resp.json().catch(() => ({}));
      console.log("Profile ingest response (HTTP):", data);
      sendResponse({ success: true, detail: { method: "http", data } });
      return;
    } catch (httpErr) {
      console.error("HTTP ingest error:", httpErr);
      sendResponse({ success: false, error: String(httpErr) });
      return;
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Ingest profile error:", errorMessage, err);
    sendResponse({ success: false, error: errorMessage });
  }
}
