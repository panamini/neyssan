React Quickstart
To get setup quickly with Convex and React run

npm create convex@latest


or follow the guide below.

Learn how to query data from Convex in a React app using Vite and
TypeScript

Create a React app
Create a React app using the create vite command.

npm create vite@latest my-app -- --template react-ts

Install the Convex client and server library
To get started, install the convex package which provides a convenient interface for working with Convex from a React app.

Navigate to your app directory and install convex.

cd my-app && npm install convex

Set up a Convex dev deployment
Next, run npx convex dev. This will prompt you to log in with GitHub, create a project, and save your production and deployment URLs.

It will also create a convex/ folder for you to write your backend API functions in. The dev command will then continue running to sync your functions with your dev deployment in the cloud.

npx convex dev

Create sample data for your database
In a new terminal window, create a sampleData.jsonl file with some sample data.

sampleData.jsonl
{"text": "Buy groceries", "isCompleted": true}
{"text": "Go for a swim", "isCompleted": true}
{"text": "Integrate Convex", "isCompleted": false}

Add the sample data to your database
Now that your project is ready, add a tasks table with the sample data into your Convex database with the import command.

npx convex import --table tasks sampleData.jsonl

(optional) Define a schema
Add a new file schema.ts in the convex/ folder with a description of your data.

This will declare the types of your data for optional typechecking with TypeScript, and it will be also enforced at runtime.

Alternatively remove the line 'plugin:@typescript-eslint/recommended-requiring-type-checking', from the .eslintrc.cjs file to lower the type checking strictness.

convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),
});

Expose a database query
Add a new file tasks.ts in the convex/ folder with a query function that loads the data.

Exporting a query function from this file declares an API function named after the file and the export name, api.tasks.get.

convex/tasks.ts
TS
import { query } from "./_generated/server";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

Connect the app to your backend
In src/main.tsx, create a ConvexReactClient and pass it to a ConvexProvider wrapping your app.

src/main.tsx
TS
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>,
);


Display the data in your app
In src/App.tsx, use the useQuery hook to fetch from your api.tasks.get API function and display the data.

src/App.tsx
TS
import "./App.css";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function App() {
  const tasks = useQuery(api.tasks.get);
  return (
    <div className="App">
      {tasks?.map(({ _id, text }) => <div key={_id}>{text}</div>)}
    </div>
  );
}

export default App;



Start the app
Start the app, open http://localhost:5173/ in a browser, and see the list of tasks.

npm run dev




Convex & Clerk
Clerk is an authentication platform providing login via passwords, social identity providers, one-time email or SMS access codes, and multi-factor authentication and basic user management.

Example: TanStack Start with Convex and Clerk

To use Clerk with Convex you'll need to complete at least steps 1 through 7 of this list.

If you're using Next.js see the Next.js setup guide after step 7.

If you're using TanStack Start see the TanStack Start setup guide after step 7.

Get started
This guide assumes you already have a working React app with Convex. If not follow the Convex React Quickstart first. Then:

Sign up for Clerk
Sign up for a free Clerk account at clerk.com/sign-up.

Sign up to Clerk

Create an application in Clerk
Choose how you want your users to sign in.

Create a Clerk application

Create a JWT Template
In the JWT Templates section of the Clerk dashboard tap on + New template and choose Convex

Copy the Issuer URL from the Issuer input field.

Hit Apply Changes.

Note: Do NOT rename the JWT token, it must be called convex.

Create a JWT template

Create the auth config
In the convex folder create a new file auth.config.ts with the server-side configuration for validating access tokens.

Paste in the Issuer URL from the JWT template and set applicationID to "convex" (the value of the "aud" Claims field).

convex/auth.config.ts
TS
export default {
  providers: [
    {
      domain: "https://your-issuer-url.clerk.accounts.dev/",
      applicationID: "convex",
    },
  ]
};

Deploy your changes
Run npx convex dev to automatically sync your configuration to your backend.

npx convex dev

Install clerk
In a new terminal window, install the Clerk React library

npm install @clerk/clerk-react

Get your Clerk Publishable key
On the Clerk dashboard in the API Keys section copy the Publishable key

Clerk publishable key setting

Configure ConvexProviderWithClerk
Now replace your ConvexProvider with ClerkProvider wrapping ConvexProviderWithClerk.

Pass the Clerk useAuth hook to the ConvexProviderWithClerk.

Paste the Publishable key as a prop to ClerkProvider.

src/main.tsx
TS
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey="pk_test_...">
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>,
);


Show UI based on authentication state
You can control which UI is shown when the user is signed in or signed out with the provided components from "convex/react" and "@clerk/clerk-react".

To get started create a shell that will let the user sign in and sign out.

Because the Content component is a child of Authenticated, within it and any of its children authentication is guaranteed and Convex queries can require it.

src/App.tsx
TS
import { SignInButton, UserButton } from "@clerk/clerk-react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function App() {
  return (
    <main>
      <Unauthenticated>
        <SignInButton />
      </Unauthenticated>
      <Authenticated>
        <UserButton />
        <Content />
      </Authenticated>
    </main>
  );
}

function Content() {
  const messages = useQuery(api.messages.getForCurrentUser);
  return <div>Authenticated content: {messages?.length}</div>;
}

export default App;

Use authentication state in your Convex functions
If the client is authenticated, you can access the information stored in the JWT via ctx.auth.getUserIdentity.

If the client isn't authenticated, ctx.auth.getUserIdentity will return null.

Make sure that the component calling this query is a child of Authenticated from "convex/react", otherwise it will throw on page load.

convex/messages.ts
TS
import { query } from "./_generated/server";

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    return await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("author"), identity.email))
      .collect();
  },
});

Login and logout Flows
Now that you have everything set up, you can use the SignInButton component to create a login flow for your app.

The login button will open the Clerk configured login dialog:

src/App.tsx
TS
import { SignInButton } from "@clerk/clerk-react";

function App() {
  return (
    <div className="App">
      <SignInButton mode="modal" />
    </div>
  );
}

To enable a logout flow you can use the SignOutButton or the UserButton which opens a dialog that includes a sign out button.

Logged-in and logged-out views
Use the useConvexAuth() hook instead of Clerk's useAuth hook when you need to check whether the user is logged in or not. The useConvexAuth hook makes sure that the browser has fetched the auth token needed to make authenticated requests to your Convex backend, and that the Convex backend has validated it:

src/App.ts
TS
import { useConvexAuth } from "convex/react";

function App() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  return (
    <div className="App">
      {isAuthenticated ? "Logged in" : "Logged out or still loading"}
    </div>
  );
}

You can also use the Authenticated, Unauthenticated and AuthLoading helper components instead of the similarly named Clerk components. These components use the useConvex hook under the hood:

src/App.ts
TS
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

function App() {
  return (
    <div className="App">
      <Authenticated>Logged in</Authenticated>
      <Unauthenticated>Logged out</Unauthenticated>
      <AuthLoading>Still loading</AuthLoading>
    </div>
  );
}

User information in functions
See Auth in Functions to learn about how to access information about the authenticated user in your queries, mutations and actions.

See Storing Users in the Convex Database to learn about how to store user information in the Convex database.

User information in React
You can access information about the authenticated user like their name from Clerk's useUser hook. See the User doc for the list of available fields:

src/badge.ts
TS
import { useUser } from "@clerk/clerk-react";

export default function Badge() {
  const { user } = useUser();
  return <span>Logged in as {user.fullName}</span>;
}

Next.js, React Native Expo, Gatsby
The ConvexProviderWithClerk component supports all Clerk integrations based on the @clerk/clerk-react library. Replace the package from which you import the ClerkProvider component and follow any additional steps in Clerk docs.

Configuring dev and prod instances
To configure a different Clerk instance between your Convex development and production deployments you can use environment variables configured on the Convex dashboard.

Configuring the backend
First, change your auth.config.ts file to use an environment variable:

convex/auth.config.ts
TS
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};

Development configuration

Open the Settings for your dev deployment on the Convex dashboard and add the variables there:

Convex dashboard dev deployment settings

Now switch to the new configuration by running npx convex dev.

Production configuration

Similarly on the Convex dashboard switch to your production deployment in the left side menu and set the values for your production Clerk instance there.

Now switch to the new configuration by running npx convex deploy.

Configuring a React client
To configure your client you can use environment variables as well. The exact name of the environment variables and the way to refer to them depends on each client platform (Vite vs Next.js etc.), refer to our corresponding Quickstart or the relevant documentation for the platform you're using.

Change the props to ClerkProvider to take in an environment variable:

src/main.tsx
TS
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <App />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>,
);




Development configuration

Use the .env.local or .env file to configure your client when running locally. The name of the environment variables file depends on each client platform (Vite vs Next.js etc.), refer to our corresponding Quickstart or the relevant documentation for the platform you're using:

.env.local
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."

Production configuration

Set the environment variable in your production environment depending on your hosting platform. See Hosting.

Debugging authentication
If a user goes through the Clerk login flow successfully, and after being redirected back to your page useConvexAuth gives isAuthenticated: false, it's possible that your backend isn't correctly configured.

The auth.config.ts file in your convex/ directory contains a list of configured authentication providers. You must run npx convex dev or npx convex deploy after adding a new provider to sync the configuration to your backend.

For more thorough debugging steps, see Debugging Authentication.

Under the hood
The authentication flow looks like this under the hood:

The user clicks a login button
The user is redirected to a page where they log in via whatever method you configure in Clerk
After a successful login Clerk redirects back to your page, or a different page which you configure via the afterSignIn prop.
The ClerkProvider now knows that the user is authenticated.
The ConvexProviderWithClerk fetches an auth token from Clerk.
The ConvexReactClient passes this token down to your Convex backend to validate
Your Convex backend retrieves the public key from Clerk to check that the token's signature is valid.
The ConvexReactClient is notified of successful authentication, and ConvexProviderWithClerk now knows that the user is authenticated with Convex. useConvexAuth returns isAuthenticated: true and the Authenticated component renders its children.
ConvexProviderWithClerk takes care of refetching the token when needed to make sure the user stays authenticated with your backend.

Step 3: Setting Up Clerk
Create a Clerk Account: Sign up for an account on Clerk’s website and create a new Clerk application.
Retrieve API Keys: Obtain your Clerk Frontend API and Backend API keys from the Clerk dashboard.
Initialize Clerk in your Next.js app: In your pages/_app.js file, wrap your application with the ClerkProvider:
import { ClerkProvider } from '@clerk/clerk-react';

const clerkFrontendApi = process.env.NEXT_PUBLIC_CLERK_FRONTEND_API;

function MyApp({ Component, pageProps }) {
  return (
    <ClerkProvider frontendApi={clerkFrontendApi}>
      <Component {...pageProps} />
    </ClerkProvider>
  );
}

export default MyApp;
4. Create Clerk Components: Add the Sign-in and Sign-up components where necessary in your application. For example, in pages/index.js:

import { SignIn, SignUp } from '@clerk/clerk-react';

export default function Home() {
  return (
    <div>
      <h1>Welcome to My App</h1>
      <SignIn />
      <SignUp />
    </div>
  );
}
Step 4: Setting Up Convex
Create a Convex Project: Sign up for Convex and create a new project on their dashboard.
Retrieve Convex Deployment URL: Obtain your deployment URL from the Convex dashboard.
Initialize Convex in your Next.js app: Create a new file convex.js to initialize Convex:
import { ConvexProviderWithAuth } from 'convex/react';
import { useSession } from '@clerk/clerk-react';
import convex from 'convex';

const convexDeploymentUrl = process.env.NEXT_PUBLIC_CONVEX_DEPLOYMENT_URL;

function ConvexWithClerkProvider({ children }) {
  const { sessionId } = useSession();

  return (
    <ConvexProviderWithAuth
      deployment={convexDeploymentUrl}
      auth={sessionId}
    >
      {children}
    </ConvexProviderWithAuth>
  );
}

export default ConvexWithClerkProvider;
4. Wrap your application with the Convex provider: Update your pages/_app.js file to include the ConvexWithClerkProvider:

import ConvexWithClerkProvider from '../convex';

function MyApp({ Component, pageProps }) {
  return (
    <ClerkProvider frontendApi={clerkFrontendApi}>
      <ConvexWithClerkProvider>
        <Component {...pageProps} />
      </ConvexWithClerkProvider>
    </ClerkProvider>
  );
}

export default MyApp;
Step 5: Using Convex and Clerk Together
Now you can use Convex’s reactive data and Clerk’s authentication in your components. Here’s an example of how to fetch user-specific data:

import { useQuery } from 'convex/react';
import { useUser } from '@clerk/clerk-react';

function UserProfile() {
  const { user } = useUser();
  const userId = user.id;
  const userData = useQuery('getUserData', { userId });

  if (!userData) return <div>Loading...</div>;

  return (
    <div>
      <h1>Welcome, {userData.name}!</h1>
      <p>Email: {userData.email}</p>
    </div>
  );
}

export default UserProfile;