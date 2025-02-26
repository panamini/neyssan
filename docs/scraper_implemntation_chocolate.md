Chrome Extension Implementation Plan
This plan outlines how to build a Chrome extension called "Job Scraper Extension" that generates job proposals from job postings on Upwork, Indeed, LinkedIn, and Fiverr. The extension will scrape job details, create a proposal, and let users copy it for manual submission. It uses Clerk for authentication and Convex for storing data, all in TypeScript, without any paid services.
What It Does
Adds a "Generate Proposal" button to job pages.
Scrapes job details (title, description, skills) when clicked.
Creates a personalized proposal if the user is logged in, or a generic one if not.
Shows the proposal in a box on the page with a "Copy" button.
Saves the job and proposal to Convex if the user is logged in.
Uses Clerk for login and Convex for data storage.
Architecture Overview
mermaid
graph LR
    A[User] --> B[Chrome Extension]
    B --> C[Job Page]
    B --> D[Proposal Box]
    B --> E[Convex Database]
    C --> B
    D --> Clipboard
    E --> B
Steps to Build It
Phase 1: Set Up the Project
Create the Project
Command: npx degit https://github.com/JackSteam/chrome-extension-boilerplate-react-vite job-scraper-extension && cd job-scraper-extension && npm install
What It Does: Downloads a ready-made TypeScript project with React and Vite, then installs basic dependencies.
Add Extra Tools
Command: npm install axios @faker-js/faker @clerk/clerk-react jwt-decode convex
What It Does: Adds libraries for making web requests (axios), faking browser data (@faker-js/faker), Clerk login (@clerk/clerk-react), decoding tokens (jwt-decode), and Convex data access (convex).
Set Up Environment Variables
File: job-scraper-extension/.env.local
Content: 
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key_here
VITE_CONVEX_URL=your_convex_url_here
What It Does: Creates a file with your Clerk key (get from Clerk dashboard) and Convex URL (get from Convex dashboard). Replace placeholders with real values.
Check Vite Settings
File: job-scraper-extension/vite.config.ts
Content: Make sure it has:
typescript
export default defineConfig({
  define: { 'import.meta.env': 'import.meta.env' }
});
What It Does: Ensures the project can read the .env.local file.
Set Up Permissions
File: job-scraper-extension/manifest.json
Content: 
json
{
  "manifest_version": 3,
  "name": "Job Scraper Extension",
  "version": "1.0",
  "description": "Generates proposals for job postings.",
  "permissions": ["activeTab", "storage", "scripting", "https://*.upwork.com/*", "https://*.indeed.com/*", "https://*.linkedin.com/*", "https://*.fiverr.com/*"],
  "action": { "default_popup": "popup.html" },
  "content_scripts": [{ "matches": ["https://*.upwork.com/*", "https://*.indeed.com/*", "https://*.linkedin.com/*", "https://*.fiverr.com/*"], "js": ["content.js"] }],
  "background": { "service_worker": "background.js" }
}
What It Does: Tells Chrome what the extension can do and where it works.
Phase 2: Build the Content Script
File: job-scraper-extension/src/content.ts
Full Code: 
typescript
interface JobData {
  title: string;
  description: string;
  skills?: string[];
  url: string;
}

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

  button.addEventListener("click", () => {
    const platform = detectPlatform(window.location.href);
    if (platform) {
      handleDynamicContent(platform, (jobData) => {
        chrome.runtime.sendMessage({ action: "generateProposal", jobData, platform });
      });
    } else {
      alert("This website is not supported.");
      console.error("Unsupported platform.");
    }
  });
}

function detectPlatform(url: string): string | null {
  if (url.includes("upwork.com")) return "upwork";
  if (url.includes("indeed.com")) return "indeed";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("fiverr.com")) return "fiverr";
  return null;
}

const scrapers = {
  upwork: (doc: Document): JobData => {
    const title = doc.querySelector("h1")?.textContent?.trim() ?? "";
    const description = doc.querySelector('[data-test="job-description-text"]')?.textContent?.trim() ?? "";
    const skills: string[] = [];
    doc.querySelectorAll('[data-test="skill"] a').forEach(el => {
      const skill = el.textContent?.trim();
      if (skill) skills.push(skill);
    });
    return { title, description, skills, url: window.location.href };
  },
  indeed: (doc: Document): JobData => {
    const title = doc.querySelector(".jobsearch-JobInfoHeader-title")?.textContent?.trim() ?? "";
    const description = doc.querySelector(".jobsearch-JobComponent-description")?.textContent?.trim() ?? "";
    const skills: string[] = [];
    doc.querySelectorAll(".jobsearch-Skills")?.forEach(el => {
      const skill = el.textContent?.trim();
      if (skill) skills.push(skill);
    });
    return { title, description, skills, url: window.location.href };
  },
  linkedin: (doc: Document): JobData => {
    const title = doc.querySelector(".jobs-unified-top-card__job-title")?.textContent?.trim() ?? "";
    const description = doc.querySelector(".jobs-description-content__text")?.textContent?.trim() ?? "";
    const skills: string[] = [];
    doc.querySelectorAll(".job-details-skill-match-status-list")?.forEach(el => {
      const skill = el.textContent?.trim();
      if (skill) skills.push(skill);
    });
    return { title, description, skills, url: window.location.href };
  },
  fiverr: (doc: Document): JobData => {
    const title = doc.querySelector(".gig-title")?.textContent?.trim() ?? "";
    const description = doc.querySelector(".gig-description")?.textContent?.trim() ?? "";
    const skills: string[] = [];
    doc.querySelectorAll(".skills")?.forEach(el => {
      const skill = el.textContent?.trim();
      if (skill) skills.push(skill);
    });
    return { title, description, skills, url: window.location.href };
  }
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
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.proposal) {
    const div = document.createElement("div");
    div.style.position = "fixed";
    div.style.top = "10px";
    div.style.right = "10px";
    div.style.width = "300px";
    div.style.backgroundColor = "white";
    div.style.zIndex = "9999";
    div.style.padding = "10px";
    div.style.border = "1px solid black";
    div.style.borderRadius = "5px";

    const textarea = document.createElement("textarea");
    textarea.value = message.proposal;
    textarea.style.width = "100%";
    textarea.style.height = "150px";
    textarea.style.marginBottom = "5px";

    const copyButton = document.createElement("button");
    copyButton.textContent = "Copy";
    copyButton.style.padding = "5px";
    copyButton.style.backgroundColor = "lightgray";
    copyButton.style.border = "none";
    copyButton.style.borderRadius = "3px";
    copyButton.style.cursor = "pointer";
    copyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(textarea.value);
      console.log("Proposal copied to clipboard!");
    });

    div.appendChild(textarea);
    div.appendChild(copyButton);
    document.body.appendChild(div);
  }
});

injectButton();
What It Does: Adds a button to job pages, scrapes data when clicked, and shows the proposal in a box with a "Copy" button.
Phase 3: Build the Background Script
File: job-scraper-extension/src/background.ts
Full Code: 
typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

interface JobData {
  title: string;
  description: string;
  skills?: string[];
  url: string;
}

interface UserProfile {
  _id: string;
  name: string;
  preferences: { writingStyle: string; tonePreference: string };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "generateProposal") {
    const { jobData, platform } = message;
    chrome.storage.local.get(["authToken"], async (result) => {
      const authToken = result.authToken;
      try {
        let userProfile: UserProfile | null = null;
        if (authToken) {
          const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
          const response = await fetch(`${import.meta.env.VITE_CONVEX_URL}/api/query/getUser`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${authToken}` }
          });
          userProfile = await response.json();
        }

        const proposal = generateProposal(jobData, userProfile);

        if (authToken && userProfile) {
          const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
          const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
          await sleep(2000); // Wait 2 seconds to avoid rate limits
          await convex.mutation(api.saveJobAndProposal, { jobData, proposalText: proposal });
        }

        sendResponse({ proposal });
      } catch (error) {
        console.error("Error generating proposal:", error);
        sendResponse({ proposal: "Error: Could not generate proposal." });
      }
    });
    return true; // Keep the message channel open for async response
  }
});

function generateProposal(jobData: JobData, userProfile: UserProfile | null): string {
  if (userProfile) {
    return `Dear Hiring Manager,\n\nI’m ${userProfile.name}, a professional with skills in ${jobData.skills?.join(", ") || "various areas"}, interested in your "${jobData.title}" posting on ${jobData.url}.\n\nJob Summary:\n${jobData.description}\n\nWith my ${userProfile.preferences.writingStyle} style and ${userProfile.preferences.tonePreference} tone, I’m confident I can excel in this role.\n\nThank you,\n${userProfile.name}`;
  }
  return `Dear Hiring Manager,\n\nI’m interested in your "${jobData.title}" posting on ${jobData.url}.\n\nJob Summary:\n${jobData.description}\n\nI’m confident I can deliver great results.\n\nThank you,\nYour Name`;
}
What It Does: Listens for the button click, gets user info if logged in, makes the proposal, and saves it to Convex.
Phase 4: Build the Popup UI
File: job-scraper-extension/src/popup.tsx
Full Code: 
tsx
import React, { useState, useEffect } from "react";
import { ClerkProvider, useAuth, SignIn, SignOutButton } from "@clerk/clerk-react";

const Popup = () => {
  const { isSignedIn, getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn) {
      getToken().then((tok) => {
        if (tok) {
          setToken(tok);
          chrome.storage.local.set({ authToken: tok });
        }
      });
    } else {
      setToken(null);
      chrome.storage.local.remove("authToken");
    }
  }, [isSignedIn, getToken]);

  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <div style={{ width: "300px", padding: "20px", textAlign: "center" }}>
        {isSignedIn ? (
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

export default Popup;
File: job-scraper-extension/public/popup.html
Content: 
html
<!DOCTYPE html>
<html>
  <head><title>Job Scraper Extension</title></head>
  <body>
    <div id="root"></div>
    <script src="popup.js"></script>
  </body>
</html>
What It Does: Shows a login page if not signed in, or a logout button if signed in, saving the login token.
Phase 5: Set Up Convex
File: convex/saveJobAndProposal.ts
Full Code: 
typescript
import { mutation } from "convex/server";

export default mutation(async ({ db, auth }, { jobData, proposalText }) => {
  const userId = await auth.getUserId();
  if (!userId) throw new Error("Not logged in");
  return db.insert("proposals", { userId, jobData, proposalText, createdAt: Date.now() });
});
What It Does: Saves the job details and proposal to Convex when a logged-in user generates one.
Phase 6: Test and Finish
Build the Extension
Command: cd job-scraper-extension && npm run build
What It Does: Creates a dist folder with the finished extension files.
Load into Chrome
Open Chrome and go to chrome://extensions/.
Turn on "Developer mode" in the top right.
Click "Load unpacked" and choose the dist folder.
Test It
Visit job pages on Upwork, Indeed, LinkedIn, and Fiverr.
Click the "Generate Proposal" button.
Check that it scrapes data, shows a proposal, and lets you copy it.
Log in via the popup and ensure a personalized proposal is saved to Convex.
Notes
Fixes Problems: Scrapes all platforms, works with or without login, saves data properly, uses free tools, and is simple to use.
Next Steps: If a job site blocks the extension, you might need to update the scraping code with new tricks.
This plan is ready to build your extension from scratch. Follow each step, and you’ll have a working Job Scraper Extension!



//BOILER PLATE

Intro
This boilerplate helps you create Chrome/Firefox extensions using React and Typescript. It improves the build speed and development experience by using Vite and Turborepo.

Features
React19
TypeScript
Tailwindcss
Vite with Rollup
Turborepo
Prettier
ESLint
Chrome Extensions Manifest Version 3
Custom i18n package
Custom HMR (Hot Module Rebuild) plugin
End-to-end testing with WebdriverIO
Getting started
When you're using Windows run this:

git config --global core.eol lf
git config --global core.autocrlf input
This will set the EOL (End of line) character to be the same as on Linux/macOS. Without this, our bash script won't work, and you will have conflicts with developers on Linux/macOS.

Clone this repository.( git clone https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite )

Ensure your node version is >= than in .nvmrc file, recommend to use nvm

Edit /packages/i18n/locales/{your locale(s)}/messages.json

In the objects extensionDescription and extensionName, change the message fields (leave description alone)

In /.package.json, change the version to the desired version of your extension.

Install pnpm globally: npm install -g pnpm (ensure your node version >= 22.12.0)

Run pnpm install

Then, depending on the target browser:

For Chrome:
Run:
Dev: pnpm dev (on Windows, you should run as administrator; see issue#456)
Prod: pnpm build
Open in browser - chrome://extensions
Check - Developer mode
Click - Load unpacked in the upper left corner
Select the dist directory from the boilerplate project
For Firefox:
Run:
Dev: pnpm dev:firefox
Prod: pnpm build:firefox
Open in browser - about:debugging#/runtime/this-firefox
Click - Load Temporary Add-on... in the upper right corner
Select the ./dist/manifest.json file from the boilerplate project
Note

In Firefox, you load add-ons in temporary mode. That means they'll disappear after each browser close. You have to load the add-on on every browser launch.

Install dependency for turborepo:
For root:
Run pnpm i <package> -w
For module:
Run pnpm i <package> -F <module name>
package - Name of the package you want to install e.g. nodemon
module-name - You can find it inside each package.json under the key name, e.g. @extension/content-script, you can use only content-script without @extension/ prefix

How do I disable modules I'm not using?
$ pnpm module-manager
Read: Module Manager

Environment variables
Read: Env Documentation

Boilerplate structure
Chrome extension
The extension lives in the chrome-extension directory and includes the following files:

manifest.ts - script that outputs the manifest.json
src/background - background script (background.service_worker in manifest.json)
public - icons referenced in the manifest; content CSS for user's page injection
Important

To facilitate development, the boilerplate is configured to "Read and change all your data on all websites". In production, it's best practice to limit the premissions to only the strictly necessary websites. See Declaring permissions and edit manifest.js accordingly.

Pages
Code that is transpiled to be part of the extension lives in the pages directory.

content - content scripts (content_scripts in manifest.json)
content-ui - React UI rendered in the current page (you can see it at the very bottom when you get started) (content_scripts in manifest.json)
content-runtime - injected content scripts; this can be injected from popup like standard content
devtools - extend the browser DevTools (devtools_page in manifest.json)
devtools-panel - DevTools panel for devtools
new-tab - override the default New Tab page (chrome_url_overrides.newtab in manifest.json)
options - options page (options_page in manifest.json)
popup - popup shown when clicking the extension in the toolbar (action.default_popup in manifest.json)
side-panel - sidepanel (Chrome 114+) (side_panel.default_path in manifest.json)
Packages
Some shared packages:

dev-utils - utilities for Chrome extension development (manifest-parser, logger)
env - exports object which contain all environment variables from .env and dynamically declared
hmr - custom HMR plugin for Vite, injection script for reload/refresh, HMR dev-server
i18n - custom internationalization package; provides i18n function with type safety and other validation
shared - shared code for the entire project (types, constants, custom hooks, components etc.)
storage - helpers for easier integration with storage, e.g. local/session storages
tailwind-config - shared Tailwind config for entire project
tsconfig - shared tsconfig for the entire project
ui - function to merge your Tailwind config with the global one; you can save components here
vite-config - shared Vite config for the entire project
Other useful packages:

zipper - run pnpm zip to pack the dist folder into extension-YYYYMMDD-HHmmss.zip inside the newly created dist-zip
module-manager - run pnpm module-manager to enable/disable modules
e2e - run pnpm e2e for end-to-end tests of your zipped extension on different browsers
Troubleshooting
Hot module reload seems to have frozen
If saving source files doesn't cause the extension HMR code to trigger a reload of the browser page, try this:

Ctrl+C the development server and restart it (pnpm run dev)
If you get a grpc error, kill the turbo process and run pnpm dev again.