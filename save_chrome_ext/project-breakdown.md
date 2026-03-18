Full Project Breakdown
Context
Goal: Chrome extension to scrape job data from Upwork/Fiverr, generate proposals via Convex, and save them.
Apps:
my-app: React frontend + Convex backend (http://localhost:5173, localhost:8181).
clerk-chrome-extension-final: Chrome extension with popup (router-based) and content script.
Specs:
Node: v20.x (assumed based on Vite/Convex compatibility).
Vite: 5.4.14 (my-app).
Plasmo: 0.90.3 (extension).
Clerk: Dev keys (pk_test_cHJlcGFyZWQtZ3J1Yndvcm0tNTcuY2xlcmsuYWNjb3VudHMuZGV2JA).
Convex: https://astute-heron-448.convex.cloud.
File Structure
~/Documents/kay/app/telo_telo_plasmo/ (root, Git repo):
my-app/:
package.json:
json
{
  "scripts": {
    "dev": "vite",
    "dev:backend": "npx convex dev"
  },
  "dependencies": {
    "convex": "^1.19.2",
    "react": "18.2.0",
    "vite": "5.4.14"
  }
}
convex/:
functions/generateProposalMutation.ts: Defines generateProposal action.
saveJobAndProposal.ts: Defines saveJobAndProposal mutation.
proposals.ts: Internal mutations/queries for proposals.
(http.ts: Added above to expose HTTP endpoints).
src/:
components/CustomToggle.tsx: React component (had duplicate React import, fixed).
clerk-chrome-extension-final/:
package.json:
json
{
  "name": "clerk-chrome-extension-final",
  "version": "0.0.1",
  "dependencies": {
    "@clerk/chrome-extension": "^1.0.0",
    "axios": "^1.6.7",
    "plasmo": "^0.90.3",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  },
  "manifest": {
    "permissions": ["activeTab", "cookies", "storage"],
    "host_permissions": ["$PLASMO_PUBLIC_CLERK_SYNC_HOST/*", "https://prepared-grubworm-57.clerk.accounts.dev/*", "https://astute-heron-448.convex.cloud/*"],
    "action": { "default_popup": "popup.html" },
    "key": "$CRX_PUBLIC_KEY"
  },
  "externals": ["react", "react-dom"]
}
.env.development:
PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cHJlcGFyZWQtZ3J1Yndvcm0tNTcuY2xlcmsuYWNjb3VudHMuZGV2JA
PLASMO_PUBLIC_CLERK_SYNC_HOST=http://localhost
.env.chrome:
CRX_PUBLIC_KEY=<YOUR_PUBLIC_KEY>
tsconfig.json:
json
{
  "extends": "plasmo/templates/tsconfig.base",
  "include": ["./**/*.ts", "./**/*.tsx", ".plasmo/index.d.ts"],
  "exclude": ["node_modules"],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "~*": ["./src/*"] },
    "lib": ["dom", "dom.iterable", "esnext"],
    "types": ["chrome", "node"],
    "jsx": "react-jsx",
    "strict": true,
    "noImplicitAny": true,
    "esModuleInterop": true
  }
}
src/:
background/index.ts: Current Axios-based version (above).
contents/content.tsx: Updated above with token sync.
popup/:
index.tsx: Router setup.
layouts/root-layout.tsx: Clerk wrapper.
routes/home.tsx: Updated above with name sync.
routes/sign-in.tsx, sign-up.tsx, settings.tsx: Unchanged.
Current Code Snippets
See above for latest content.tsx, home.tsx, background.ts—others unchanged.
Errors and Problems
404 on /api/generateProposal and /api/saveJobAndProposal:
Expected to work per Convex files, but fail—likely needs http.ts.
Auth Token Timing: Content script misses token initially—fixed with listener.
Name Sync: "Your Name" instead of new email’s name—fixed with useUser() update.
Context Apps
my-app: React + Convex, runs on localhost:5173 (Vite) and localhost:8181 (Convex).
Extension: Syncs auth with my-app via Clerk’s syncHost.
