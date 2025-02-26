Updated Plan







Here’s the refocused plan with your error handling added, keeping everything else aligned with our "good enough" JobScraperExtensionPlan.md:
Step 3: Background Script (job_scraper/chrome-extension/src/background/index.ts)
typescript
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
Step 5: Convex Setup (Updated)
Directory: Use my-app/convex/.
Add getUser.ts:
typescript
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
Keep saveJobAndProposal.ts:
typescript
// my-app/convex/saveJobAndProposal.ts
import { mutation } from './_generated/server';

export default mutation(async ({ db, auth }, { jobData, proposalText }) => {
  const userId = await auth.getUserId();
  if (!userId) throw new Error("Not logged in");
  return db.insert("proposals", { userId, jobData, proposalText, createdAt: Date.now() });
});
Run:
bash
cd /Users/pana/Documents/kay/app/telo_telo/my-app
npx convex dev
Select the existing my-app project (e.g., match VITE_CONVEX_URL or CONVEX_DEPLOYMENT from my-app/.env.local).
Push updates:
bash
npx convex push
Copy Types:
bash
cp -r /Users/pana/Documents/kay/app/telo_telo/my-app/convex/_generated /Users/pana/Documents/kay/app/telo_telo/job_scraper/convex/



Next Steps
Implement:
Add getUser.ts with your error handling to my-app/convex/.
Ensure saveJobAndProposal.ts is in my-app/convex/.
Update background/index.ts as above.
Run npx convex dev and npx convex push in my-app.
Copy the _generated/ folder to job_scraper/convex/.
