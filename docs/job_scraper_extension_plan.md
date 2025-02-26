# Job Scraper Extension: Comprehensive Plan

This document outlines the context, architecture, and implementation plan for the Job Scraper Extension, a Chrome extension designed to generate job proposals based on job postings from Upwork, Indeed, LinkedIn, and Fiverr.

## 1. Context and Overview

The Job Scraper Extension aims to streamline the job application process by automatically generating tailored proposals. It leverages existing infrastructure from a related project (`my-app`) which uses Convex for its backend and Clerk for authentication. The extension will:

- **Scrape Job Data:** Extract relevant information (title, description, required skills) from job postings on supported platforms.
- **Generate Proposals:** Utilize a pre-existing Convex action (originally built for `my-app`) to create proposals. This action uses LangChain with GPT-4 and Mistral models.
- **Provide User Interface:** Display a "Generate Proposal" button on job pages and show the generated proposal in a copyable format.
- **Handle Authentication:** Integrate with Clerk for user login/logout via a popup window.
- **Reuse Existing Backend:** Communicate with the existing `my-app` Convex backend for proposal generation and (potentially) user data. *No new Convex functions are required.*

## 2. Architecture

The extension consists of three main parts:

- **Content Script:** Injected into supported job posting websites. Responsible for scraping job data and adding the UI button.
- **Background Script:** Manages communication between the content script and the Convex backend. Handles authentication and makes requests to the Convex action.
- **Popup:** Provides a simple interface for users to log in and out using Clerk.

The extension interacts with the existing `my-app` Convex backend via HTTP requests. It does *not* directly access or modify the `my-app` codebase.

```mermaid
graph LR
    A[User] --> B[Chrome Extension]
    B -->|Content Script| C[Job Page (Upwork, Indeed, LinkedIn, Fiverr)]
    B -->|Background Script| D[Convex Backend (my-app)]
    B -->|Popup| E[Clerk Authentication]
    C -->|Scrapes Job Data| B
    B -->|Sends Job Data| D
    D -->|HTTP Request| F[Convex Backend]
    F -->|Returns Proposal| D
    D -->|Displays Proposal| B
    B --> G[Proposal Box]
    G -->|Copy to Clipboard| H[Clipboard]
    I[Popup] -->|Auth Token| D
    J[Clerk] -->|Provides Token| I



```
Key Components:
job_scraper (Chrome Extension):
chrome-extension/manifest.ts (or manifest.json): Defines extension permissions and entry points. Note: manifest.ts typically compiles to dist/manifest.json. Check your Vite configuration and the output directory after building.
pages/content/src/index.tsx: Content script (React).
chrome-extension/src/background/index.ts: Background script (TypeScript).
pages/popup/src/index.tsx: Popup UI (React).
chrome-extension/.env.local: Contains VITE_CLERK_PUBLISHABLE_KEY and VITE_CONVEX_URL.
my-app (Existing Convex Backend):
convex/functions/generateProposalMutation.ts: Convex action that generates proposals.
convex/users.ts: Convex functions for managing user data (including Clerk integration).
convex/proposals.ts: Convex functions for managing proposals.
.env.local: Contains CONVEX_DEPLOYMENT, VITE_CONVEX_URL, VITE_CLERK_PUBLISHABLE_KEY, OPENAI_API_KEY, MISTRAL_API_KEY, CLERK_JWT_ISSUER_DOMAIN. Note: API keys must also be set as environment variables within the Convex dashboard. Ensure these match the values in my-app/.env.local.
3. Implementation Plan
This plan outlines the steps to build the extension, leveraging the existing my-app backend.
Step 1: Project Setup (Extension)
Boilerplate: The boilerplate is already set up. Confirm: Any previous Git issues are resolved. If not using Jonghakseo/chrome-extension-boilerplate-react-vite, specify the exact boilerplate.
Install Dependencies:
bash
pnpm add axios @clerk/clerk-react -F chrome-extension
(Removed jwt-decode as it's not needed.)
Environment Variables: Create job_scraper/chrome-extension/.env.local:
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cHJlcGFyZWQtZ3J1Yndvcm0tNTcuY2xlcmsuYWNjb3VudHMuZGV2JA
VITE_CONVEX_URL=https://astute-heron-448.convex.cloud
(These values were obtained from my-app/.env.local). Double-check: VITE_CONVEX_URL matches your deployed Convex instance's public URL.
Vite Configuration: Verify job_scraper/chrome-extension/vite.config.mts includes:
typescript
export default defineConfig({
  define: { 'import.meta.env': 'import.meta.env' },
  // ... other configurations ...
  plugins: [
    // ... other plugins ...
    // If using a boilerplate like Jonghakseo's, ensure this is present:
    // vite-plugin-chrome-extension(),
  ],
});
Manifest File: Create/modify job_scraper/chrome-extension/manifest.ts to output:
json
{
  "manifest_version": 3,
  "name": "Job Scraper Extension",
  "version": "1.0",
  "description": "Generates proposals for job postings.",
  "permissions": ["activeTab", "storage", "https://*.upwork.com/*", "https://*.indeed.com/*", "https://*.linkedin.com/*", "https://*.fiverr.com/*"],
  "action": { "default_popup": "index.html" },
  "content_scripts": [{ "matches": ["https://*.upwork.com/*", "https://*.indeed.com/*", "https://*.linkedin.com/*", "https://*.fiverr.com/*"], "js": ["dist/content.js"] }],
  "background": { "service_worker": "dist/background.js" }
}
Important: The js paths in content_scripts and background should point to the compiled output files (likely in dist/). Adjust these if necessary after building. (Removed scripting permission).
Step 2: Content Script (job_scraper/pages/content/src/index.tsx)
typescript
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';

interface JobData {
  title: string;
  description: string;
  skills?: string[];
  url: string;
}

type Scraper = (doc: Document) => JobData;

function injectButton() {
  const button = document.createElement("button");
  button.textContent = "Generate Proposal";
  button.style.position = "fixed";
  button.style.bottom = "10px";
  button.style.right = "10px";
  button.style.padding = "10px";
  button.style.backgroundColor = "blue";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "5px";
  button.style.cursor = "pointer";
  button.style.zIndex = "9999";
  document.body.appendChild(button);

  let timeout: NodeJS.Timeout; // For debouncing

  button.addEventListener("click", () => {
    clearTimeout(timeout); // Clear any existing timeout
    button.disabled = true; // Disable button during generation
    button.textContent = "Generating..."; // Provide visual feedback

    timeout = setTimeout(() => { // Debounce the button click
      const platform = detectPlatform(window.location.href);
      if (platform) {
        handleDynamicContent(platform, (jobData) => {
          chrome.runtime.sendMessage({
            action: "generateProposal",
            jobData,
            platform,
          });
        });
      } else {
        alert("This website is not supported.");
        console.error("Unsupported platform.");
        button.disabled = false; // Re-enable button
        button.textContent = "Generate Proposal"; // Reset text
      }
    }, 500); // 500ms debounce
  });
}

function detectPlatform(url: string): string | null {
  if (url.includes("upwork.com")) return "upwork";
  if (url.includes("indeed.com")) return "indeed";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("fiverr.com")) return "fiverr";
  return null;
}

const scrapers: Record<string, Scraper> = {
  upwork: (doc: Document): JobData => {
    const title = doc.querySelector("h1, h2, [class*='title']")?.textContent?.trim() ?? ""; // Fallback selectors
    const description =
      doc.querySelector('[data-test="job-description-text"], [class*="description"]')?.textContent?.trim() ?? ""; // Fallback selectors
    const skills: string[] = [];
    doc.querySelectorAll('[data-test="skill"] a, [class*="skill"] a').forEach((el) => { // Fallback selectors
      const skill = el.textContent?.trim();
      if (skill) skills.push(skill);
    });
    console.log("Upwork Scraped Data:", { title, description, skills, url: window.location.href }); // Debugging
    return { title, description, skills, url: window.location.href };
  },
  indeed: (doc: Document): JobData => {
    const title =
      doc.querySelector(".jobsearch-JobInfoHeader-title, h1, h2, [class*='title']")?.textContent?.trim() ?? ""; // Fallback selectors
    const description =
      doc.querySelector(".jobsearch-JobComponent-description, [class*='description']")?.textContent?.trim() ?? ""; // Fallback selectors
    const skills: string[] = [];
    doc.querySelectorAll(".jobsearch-Skills, [class*='skill']").forEach((el) => { // Fallback selectors
      const skill = el.textContent?.trim();
      if (skill) skills.push(skill);
    });
    console.log("Indeed Scraped Data:", { title, description, skills, url: window.location.href }); // Debugging
    return { title, description, skills, url: window.location.href };
  },
  linkedin: (doc: Document): JobData => {
    const title =
      doc.querySelector(".jobs-unified-top-card__job-title, h1, h2, [class*='title']")?.textContent?.trim() ?? ""; // Fallback selectors
    const description =
      doc.querySelector(".jobs-description-content__text, [class*='description']")?.textContent?.trim() ?? ""; // Fallback selectors
    const skills: string[] = [];
    doc.querySelectorAll(".job-details-skill-match-status-list, [class*='skill']")?.forEach((el) => { // Fallback selectors
      const skill = el.textContent?.trim();
      if (skill) skills.push(skill);
    });
    console.log("LinkedIn Scraped Data:", { title, description, skills, url: window.location.href }); // Debugging
    return { title, description, skills, url: window.location.href };
  },
  fiverr: (doc: Document): JobData => {
    const title = doc.querySelector(".gig-title, h1, h2, [class*='title']")?.textContent?.trim() ?? ""; // Fallback selectors
    const description = doc.querySelector(".gig-description, [class*='description']")?.textContent?.trim() ?? ""; // Fallback selectors
    const skills: string[] = [];
    doc.querySelectorAll(".skills, [class*='skill']")?.forEach((el) => { // Fallback selectors
      const skill = el.textContent?.trim();
      if (skill) skills.push(skill);
    });
    console.log("Fiverr Scraped Data:", { title, description, skills, url: window.location.href }); // Debugging
    return { title, description, skills, url: window.location.href };
  },
};

function handleDynamicContent(platform: string, callback: (data: JobData) => void) {
  const observer = new MutationObserver((mutations, observer) => {
    try {
      const jobData = scrapers[platform](document);
      if (jobData.title && jobData.description) {
        observer.disconnect();
        callback(jobData);
      }
    } catch (error) {
      console.error("Error scraping job data:", error);
      alert("Failed to scrape job data. Try again later.");
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Timeout to disconnect observer if no data found after 5 seconds
  setTimeout(() => {
    if (observer.disconnect) {
      observer.disconnect();
      console.warn(`Observer timed out for platform: ${platform}`);
      alert("Failed to scrape job data.  The page structure may not be supported.");
      button.disabled = false; // Re-enable button
      button.textContent = "Generate Proposal"; // Reset text
    }
  }, 5000);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.proposal) {
    const existing = document.querySelector('.proposal-box'); // Check for existing box
    if (existing) existing.remove(); // Remove if it exists

    const div = document.createElement("div");
    const shadow = div.attachShadow({ mode: "open" }); // Use Shadow DOM

    shadow.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: 10px;
          right: 10px;
          width: 300px;
          background-color: white;
          z-index: 9999;
          padding: 10px;
          border: 1px solid black;
          border-radius: 5px;
        }
        textarea {
          width: 100%;
          height: 150px;
          margin-bottom: 5px;
          resize: vertical; /* Allow vertical resizing */
        }
        button {
          padding: 5px;
          background-color: lightgray;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          margin-right: 5px; /* Add margin between buttons */
        }
      </style>
    `;

    const textarea = document.createElement("textarea");
    textarea.value = message.proposal || ''; // Ensure message.proposal is defined
    // Consider adding basic sanitization here if Convex might return HTML:
    // textarea.textContent = sanitize(message.proposal);

    const copyButton = document.createElement("button");
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(textarea.value).then(() => {
        console.log("Proposal copied to clipboard!");
      }).catch(err => {
        console.error("Failed to copy:", err);
        alert("Failed to copy proposal to clipboard.");
      });
    });

    const closeButton = document.createElement("button");
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", () => {
      div.remove();
    });

    shadow.appendChild(textarea);
    shadow.appendChild(copyButton);
    shadow.appendChild(closeButton);
    document.body.appendChild(div);

    button.disabled = false; // Re-enable button after displaying proposal
    button.textContent = "Generate Proposal"; // Reset text
  }
});

injectButton();
Step 3: Background Script (job_scraper/chrome-extension/src/background/index.ts)
import axios from 'axios';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api"; // From my-app/convex/

const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

interface GenerateMessage {
  action: "generateProposal";
  jobData: JobData;
  platform: string;
}

chrome.runtime.onMessage.addListener(
  (message: GenerateMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: { proposal: string }) => void) => {
    if (message.action === "generateProposal") {
      generateProposalHandler(message, sendResponse);
    }
    return true;
  }
);

async function generateProposalHandler(message: GenerateMessage, sendResponse: (response: { proposal: string }) => void) {
  chrome.storage.local.get(["authToken"], async (result) => {
    const authToken = result.authToken;

    if (!authToken) {
      sendResponse({ proposal: "Error: Please log in to generate proposals." });
      return;
    }

    client.setAuth(authToken); // Set auth for Convex client
    const headers = { Authorization: `Bearer ${authToken}` }; // For axios

    try {
      // Fetch user data (optional enhancement)
      let userName = "Your Name";
      try {
        const user = await client.query(api.users.getUser);
        if (user) userName = user.name; // Use fallback if user fetch fails
      } catch (error) {
        console.warn("Failed to fetch user data:", error.message);
      }

      // Keep axios for generateProposal
      const proposalResponse = await axios.post(
        `${import.meta.env.VITE_CONVEX_URL}/api/action/functions/generateProposal`,
        {
          jobTitle: message.jobData.title,
          jobDescription: message.jobData.description,
          proposalType: "technical",
          formalityLevel: "formal",
          creativity: "standard",
          modelType: "mistral-small-latest",
        },
        { headers }
      );
      const proposalContent = proposalResponse.data.proposalContent;

      // Save to Convex
      await client.mutation(api.saveJobAndProposal, {
        jobData: message.jobData,
        proposalText: proposalContent,
      });

      sendResponse({ proposal: `${proposalContent}\n\nGenerated for: ${userName}` });
    } catch (error) {
      console.error("Error generating or saving proposal:", error);
      sendResponse({ proposal: "Error: Could not generate proposal." });
    }
  });
}
Step 4: Popup UI (job_scraper/pages/popup/src/index.tsx and job_scraper/pages/popup/index.html)
job_scraper/pages/popup/src/index.tsx
typescript
import React, { useState, useEffect } from "react";
import { ClerkProvider, useAuth, SignIn, SignOutButton } from "@clerk/clerk-react";

const Popup = () => {
  const { isSignedIn, getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    if (isSignedIn) {
      getToken().then((tok) => {
        if (tok) {
          setToken(tok);
          chrome.storage.local.set({ authToken: tok });
        } else {
          console.error("Failed to get token"); // Handle null token
        }
        setLoading(false);
      }).catch((err) => {
        console.error("Token fetch error:", err); // Handle fetch errors
        setLoading(false);
      });
    } else {
      setToken(null);
      chrome.storage.local.remove("authToken");
      setLoading(false);
    }
  }, [isSignedIn, getToken]);

  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <div style={{ width: "300px", padding: "20px", textAlign: "center", minHeight: '100px' }}>
        {loading ? (
          <p>Loading...</p> // Display loading message
        ) : isSignedIn ? (
          <>
            <p>Logged in</p>
            <SignOutButton />
          </>
        ) : (
          <SignIn />
        )}
      </div>
    </ClerkProvider>
  );
};

// Use 'root' element if it exists, otherwise create it.
const rootElement = document.getElementById('root') || document.createElement('div');
if (!document.getElementById('root')) {
  document.body.appendChild(rootElement);
}

ReactDOM.createRoot(rootElement).render(<Popup />);
job_scraper/pages/popup/index.html
html
<!DOCTYPE html>
<html>
  <head>
    <title>Job Scraper Extension</title>
  </head>
  <body>
    <!-- Removed duplicate <div id="root"></div> -->
    <script src="dist/index.js"></script> <!-- Verify this path after build -->
  </body>
</html>


STEP 5A: CONVEX SETUP
// my-app/convex/users.ts
import { query } from './_generated/server';

export const getUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query('users')
      .withIndex('by_token', (q) => q.eq('tokenIdentifier', identity.tokenIdentifier))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  },
});

Step 5: Build and Load
Run pnpm build -F chrome-extension in the job_scraper directory.
Load the unpacked extension in Chrome:
Go to chrome://extensions/.
Enable "Developer mode".
Click "Load unpacked".
Select the job_scraper/dist directory (or the correct output directory if it's different, check chrome-extension/vite.config.mts).
Step 6: Testing
Visit job pages on Upwork, Indeed, LinkedIn, and Fiverr.
Click the "Generate Proposal" button.
Verify that the proposal is generated and displayed.
Test both logged-in and logged-out scenarios.
Check the browser's developer console for any errors.
Test a scenario where proposal generation fails (e.g., provide a job posting with an empty title or description, or temporarily disable your internet connection to simulate Convex downtime).
Notes:
API Keys: Ensure OPENAI_API_KEY, MISTRAL_API_KEY, and MISTRAL_AGENT_ID are set as environment variables in your Convex dashboard, and that they match the values in my-app/.env.local.
Error Handling: The provided code includes basic error handling. Consider adding more specific error messages and potentially a retry mechanism.
Rate Limiting: The content script includes a simple debounce to prevent rapid button clicks. You might need more sophisticated rate limiting depending on the Convex action's limits.
UI Improvements:
Loading Indicator: Added a loading indicator to the content script's button and the popup.
Options: Consider adding UI elements (e.g., in the popup or a dedicated options page) to allow users to select proposal type, formality, creativity, and the AI model.
Proposal Management: Explore adding features to view, edit, and manage previously generated proposals (this would likely require additional Convex functions and a new table - consider this a scope extension).
Selector Updates: The CSS selectors used for scraping may need to be updated periodically if the target websites change their HTML structure. Establish a maintenance plan (e.g., monthly checks).

---

### How to Use This
1. **Save the File**: Copy the above content into a file named `JobScraperExtensionPlan.md`.
2. **Render It**: Open it in a Markdown viewer (e.g., VS Code, GitHub, or a local Markdown renderer) to see the formatted version with headings, code blocks, and the Mermaid diagram.
3. **Implement**: Use it as your blueprint to build the extension.

This Markdown file is clean, portable, and reflects your latest plan exactly as submitted, with improved formatting for readability and consistency. You’re all set to proceed! Let me know if you need anything else.


///NOTES /REMARKS
Client Setup: Instead of using axios, you should use the Convex client libraries. For a browser environment (which seems to be your case with a Chrome extension), you should use the ConvexHttpClient. Here's how you set it up:

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
Client documentation
Querying Data: Instead of making a POST request to fetch user data, you should use the Convex client's query method:

const user = await client.query(api.users.getUser);
Mutations: Similarly, for saving data, use the mutation method:

await client.mutation(api.saveJobAndProposal, {
  jobData: message.jobData,
  proposal: proposal,
});
Authentication: Convex handles authentication differently. You don't need to manually add the token to the headers. Instead, you should set up authentication as described in the Convex Auth documentation.
Here's a revised version of your code that aligns more closely with Convex best practices:

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);

async function generateProposal(jobData: any, user: any): Promise<string> {
    console.log("jobData", jobData);
    console.log("user", user);
    return `Proposal for ${jobData.title} (Placeholder)`;
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'generateProposal') {
        try {
            const user = await client.query(api.users.getUser);

            if (user) {
                const proposal = await generateProposal(message.jobData, user);

                await client.mutation(api.saveJobAndProposal, {
                    jobData: message.jobData,
                    proposal: proposal,
                });

                sendResponse({ proposal });
            } else {
                sendResponse({ proposal: 'User not found.' });
            }
        } catch (error) {
            console.error('Error fetching user or generating proposal:', error);
            sendResponse({ proposal: 'An error occurred.' });
        }
    }
    return true; // Indicates that sendResponse will be called asynchronously
});
Remember to set up authentication properly as per the Convex documentation. Also, ensure that your Convex functions (getUser and saveJobAndProposal) are correctly defined in your Convex backend.
Lastly, since you're working in a Chrome extension environment, you might need to adjust how you initialize and use the Convex client. The exact implementation might depend on your extension's architecture and the specific Convex features you're using.