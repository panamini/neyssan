import { ConvexClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const convex = new ConvexClient("https://giddy-basilisk-88.convex.cloud");
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
    chrome.runtime.sendMessage({ action: "refreshToken" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Refresh failed:", chrome.runtime.lastError.message);
        resolve(null); // Gracefully handle failure
      } else {
        console.log("Refreshed token:", response?.token);
        resolve(response?.token || null);
      }
    });
  });
}

convex.setAuth(async () => {
  if (!currentToken) {
    currentToken = await getClerkToken();
    if (!currentToken) {
      console.log("No valid token, attempting refresh");
      currentToken = await refreshToken();
    }
    console.log("Initial token for Convex:", currentToken);
  }
  return currentToken;
});

setInterval(async () => {
  const token = await getClerkToken();
  if (!token) {
    currentToken = await refreshToken();
  } else {
    currentToken = token;
  }
  convex.setAuth(() => Promise.resolve(currentToken));
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
  action: "generateProposal" | "saveProposal" | "test";
  jobData?: JobData;
  proposalText?: string;
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
    convex.setAuth(() => Promise.resolve(currentToken));
    console.log("Token before action:", currentToken);
    console.log("Calling action:", api.generateProposalMutation.default._name);
    const result = await convex.action(api.generateProposalMutation.default, {
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
    convex.setAuth(() => Promise.resolve(currentToken));
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