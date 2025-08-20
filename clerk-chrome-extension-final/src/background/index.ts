import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

 // Use dev deployment (neat-starfish-33) for extension background calls.
const convex = new ConvexHttpClient("https://neat-starfish-33.convex.cloud");
let currentToken: string | null = null;

async function getClerkToken(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get("authToken", (result) => {
      const token = result.authToken as string | undefined;
      console.log("Retrieved token from storage:", token);
      if (!token) {
        console.log("No token in storage");
        resolve(null);
        return;
      }
      const decoded = parseJwt(token);
      console.log("Decoded token:", decoded);
      if (decoded && typeof decoded.exp === "number" && decoded.exp > Math.floor(Date.now() / 1000)) {
        resolve(token);
      } else {
        console.log("Token expired or invalid");
        resolve(null);
      }
    });
  });
}

const parseJwt = (token: string): { exp?: number } | null => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error("Failed to parse JWT:", e);
    return null;
  }
};

async function refreshToken(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        // runtime not available in this environment
        console.warn("refreshToken: chrome.runtime.sendMessage not available");
        resolve(null);
        return;
      }

      let responded = false;
      // Send a message and wait for response; fallback to null after timeout
      chrome.runtime.sendMessage({ action: "refreshToken" }, (response) => {
        responded = true;
        if (chrome.runtime.lastError) {
          // Do not throw — just log a warning and resolve null
          console.warn("Refresh failed:", chrome.runtime.lastError?.message ?? chrome.runtime.lastError);
          resolve(null);
        } else {
          console.log("Refreshed token:", response?.token);
          resolve(response?.token || null);
        }
      });

      // Timeout fallback in case there is no listener / no response
      setTimeout(() => {
        if (!responded) {
          console.warn("refreshToken: no response from runtime, resolving null");
          resolve(null);
        }
      }, 1200);
    } catch (e) {
      console.warn("refreshToken error:", e);
      resolve(null);
    }
  });
}

(async () => {
  if (!currentToken) {
    currentToken = await getClerkToken();
    if (!currentToken) {
      console.log("No valid token, attempting refresh");
      currentToken = await refreshToken();
    }
    console.log("Initial token for Convex:", currentToken);
  }
  // ConvexHttpClient.setAuth expects a string; pass empty string when no token available.
  convex.setAuth(currentToken ?? "");
})();

setInterval(async () => {
  const token = await getClerkToken();
  if (!token) {
    currentToken = await refreshToken();
  } else {
    currentToken = token;
  }
  convex.setAuth(currentToken ?? "");
  console.log("Periodic token refresh:", currentToken);
}, 5 * 60 * 1000);

interface JobData {
  platform: string;
  title: string;
  description?: string;
  url: string;
  proposalType?: "technical" | "creative";
  formalityLevel?: "informal" | "formal" | "neutral";
  creativity?: "low" | "medium" | "high";
  modelType?: "chatgpt" | "mistral-small-latest" | "mistral-large-latest" | "mistral-agent";
}

interface Message {
  action: "generateProposal" | "saveProposal" | "ingestProfile" | "test";
  jobData?: JobData;
  proposalText?: string;
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
  console.log("Message received:", message);
  switch (message.action) {
    case "generateProposal":
      generateProposalHandler(message, sendResponse);
      return true;
    case "saveProposal":
      saveProposalHandler(message, sendResponse);
      return true;
    case "ingestProfile":
      // message.profile expected
      ingestProfileHandler(message.profile, sendResponse);
      return true;
    case "test":
      console.log("Handling test message");
      sendResponse({ success: true, message: "Background test successful" });
      return true;
    default:
      console.warn("Unknown action:", message.action);
      return false;
  }
});

async function generateProposalHandler(
  message: Message,
  sendResponse: (response: { success: boolean; proposal?: string; error?: string }) => void
) {
  try {
    currentToken = await getClerkToken();
    if (!currentToken) {
      console.log("No valid token, attempting refresh");
      currentToken = await refreshToken();
      if (!currentToken) throw new Error("No auth token available after refresh");
    }
    convex.setAuth(currentToken ?? "");
    console.log("Token before action:", currentToken);
    // Call the generateProposal function via Convex HTTP client (action)
    console.log("Calling function generateProposal via action");
    const result = await convex.action(api.functions.generateProposal, {
      jobTitle: message.jobData!.title,
      jobDescription: message.jobData!.description || "No description provided",
      proposalType: message.jobData?.proposalType || "technical",
      formalityLevel: message.jobData?.formalityLevel || "formal",
      creativity: message.jobData?.creativity || "standard",
      modelType: message.jobData?.modelType || "mistral-small-latest",
    });
    console.log("Action result:", result);
    sendResponse({ success: true, proposal: result.proposalContent });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Generate proposal error:", errorMessage, error);
    sendResponse({ success: false, error: errorMessage });
  }
}

async function saveProposalHandler(
  message: Message,
  sendResponse: (response: { success: boolean; error?: string }) => void
) {
  try {
    currentToken = await getClerkToken();
    if (!currentToken) {
      console.log("No valid token, attempting refresh");
      currentToken = await refreshToken();
      if (!currentToken) throw new Error("No auth token available after refresh");
    }
    convex.setAuth(currentToken ?? "");
    console.log("Token before mutation:", currentToken);
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
    currentToken = await getClerkToken();
    if (!currentToken) {
      console.log("No valid token, attempting refresh");
      currentToken = await refreshToken();
      if (!currentToken) throw new Error("No auth token available after refresh");
    }
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
      const ingestUrl = "https://neat-starfish-33.convex.cloud/api/http/profiles/ingest";
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
