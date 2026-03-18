// background.ts
import axios from 'axios';
import { ConvexHttpClient } from 'convex/browser';
import { api } from './convex/_generated/api';

console.log("Background script loaded successfully");
const convexUrl = "https://astute-heron-448.convex.cloud";
const client = new ConvexHttpClient(convexUrl);

interface JobData {
  platform: string;
  title: string;
  description?: string;
  url: string;
}

interface GenerateMessage {
  action: 'generateProposal' | 'saveProposal' | 'test';
  jobData?: JobData;
  platform?: string;
  proposalText?: string;
}

chrome.runtime.onMessage.addListener(
  (message: GenerateMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: { proposal?: string; success?: boolean }) => void) => {
    console.log('Message received:', message);
    if (message.action === 'generateProposal') {
      generateProposalHandler(message, sendResponse);
    } else if (message.action === 'saveProposal') {
      saveProposalHandler(message, sendResponse);
    } else if (message.action === 'test') {
      sendResponse({ success: true });
      console.log("Test message from popup");
    }
    return true;
  }
);

async function generateProposalHandler(message: GenerateMessage, sendResponse: (response: { proposal?: string }) => void) {
  chrome.storage.local.get(['authToken'], async (result) => {
    const authToken = result.authToken as string | undefined;
    if (!authToken) {
      console.log("No auth token found");
      sendResponse({ proposal: 'Error: Please log in to generate proposals.' });
      return;
    }
    client.setAuth(authToken);
    try {
      const proposalResponse = await axios.post(
        `${convexUrl}/api/action/functions/generateProposal`,
        {
          jobTitle: message.jobData!.title,
          jobDescription: message.jobData!.description ?? 'No description provided',
          proposalType: 'technical',
          formalityLevel: 'formal',
          creativity: 'standard',
          modelType: 'mistral-small-latest',
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const { proposalContent } = proposalResponse.data;
      console.log('Proposal generated:', proposalContent);
      sendResponse({ proposal: proposalContent });
    } catch (error: unknown) {
      console.error('Error generating proposal:', error instanceof Error ? error.message : String(error));
      sendResponse({ proposal: 'Error: Could not generate proposal.' });
    }
  });
}

async function saveProposalHandler(message: GenerateMessage, sendResponse: (response: { success?: boolean }) => void) {
  chrome.storage.local.get(['authToken'], async (result) => {
    const authToken = result.authToken as string | undefined;
    if (!authToken) {
      console.log("No auth token found");
      sendResponse({ success: false });
      return;
    }
    client.setAuth(authToken);
    try {
      const user = await client.query(api.users.getUser);
      if (!user) throw new Error('User not found');
      await client.mutation(api.saveJobAndProposal.default, {
        jobData: message.jobData!,
        proposalText: message.proposalText ?? '',
      });
      console.log('Proposal saved for user:', user._id);
      sendResponse({ success: true });
    } catch (error: unknown) {
      console.error('Error saving proposal:', error instanceof Error ? error.message : String(error));
      sendResponse({ success: false });
    }
  });
}