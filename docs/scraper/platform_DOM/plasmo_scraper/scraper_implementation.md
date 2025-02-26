Project Setup: implementation of @scraper_implemntation_chocolate.md follow @#ai_driven_code_guidelines.md
Yes, the scraper extension should reuse the existing Clerk and Convex configuration from the my-app/ directory, including the user base.

For the environment variables, we will create a separate .env.local file within the scraper/ directory. I will copy the values of VITE_CLERK_PUBLISHABLE_KEY and VITE_CONVEX_URL from my-app/.env.local into scraper/.env.local.
Verify boilerplate installation using npx degit ... and npm install as specified.
Install additional dependencies: axios, @faker-js/faker, @clerk/clerk-react, jwt-decode, and convex.
Set up environment variables in .env.local with VITE_CLERK_PUBLISHABLE_KEY and VITE_CONVEX_URL.
Verify vite.config.ts includes the necessary define configuration.
Set up manifest.json with the correct permissions and file references.
All code will be written in TypeScript, using functional components and interfaces.
Content Script (src/content.ts):

Implement injectButton to add the "Generate Proposal" button.
Implement detectPlatform to identify the job site (Upwork, Indeed, LinkedIn, Fiverr).
Create scrapers object with platform-specific scraping logic using DOM selectors.
Implement handleDynamicContent with a MutationObserver to handle dynamically loaded content.
Add a listener for messages from the background script to display the proposal.
Adhere to SOLID and DRY principles, keeping functions small and focused.
Background Script (src/background.ts):

Listen for messages from the content script (generateProposal action).
Retrieve the authentication token from chrome.storage.local.
If authenticated, fetch user profile data from Convex.
Call generateProposal function to create the proposal text (personalized or generic).
If authenticated, save the job data and proposal to Convex using convex.mutation.
Send the generated proposal back to the content script.
Use pure functions and dependency injection where appropriate.
Popup UI (src/popup.tsx and public/popup.html):

Use @clerk/clerk-react components (ClerkProvider, useAuth, SignIn, SignOutButton) to handle authentication.
Store the authentication token in chrome.storage.local on login/logout.
Create a simple UI with login/logout functionality.
Convex Setup (convex/saveJobAndProposal.ts):

Create a Convex mutation function to save job data and proposals.
Ensure the function checks for user authentication before saving.
Testing:

Write unit tests for individual functions (scrapers, proposal generation).
Write end-to-end tests to simulate user interaction and verify the entire flow.
AI-Driven Code Guidelines:

Follow all guidelines related to code style, structure, naming, TypeScript, UI, performance, Web3, and best practices.
I am now ready to proceed with the implementation. Please toggle to Act Mode.