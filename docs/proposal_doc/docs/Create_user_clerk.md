I recommend implementing Clerk with Convex for user management now, rather than creating a separate user system. Here's why and how you should proceed:
Defining the users module in the schema: First, you'll need to define a schema for your users table. Create or update a file named convex/schema.ts:

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    // Add any other fields you want to store
  }).index("by_clerk_id", ["clerkId"]),
});
Implementing user management logic with Clerk: Now, let's implement the user management logic in convex/users.ts:

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const createOrUpdateUser = internalMutation({
  args: { 
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { clerkId, email, name } = args;
    
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existingUser) {
      // Update existing user
      return await ctx.db.patch(existingUser._id, { email, name });
    } else {
      // Create new user
      return await ctx.db.insert("users", { clerkId, email, name });
    }
  },
});

export const deleteUser = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});
Updating the Clerk webhook handler: Modify your Clerk webhook handler in your main auth file to use these new functions:

import { internal } from "./_generated/api";

// In your Clerk webhook handler
switch (evt.type) {
  case "user.created":
  case "user.updated":
    await ctx.runMutation(internal.users.createOrUpdateUser, {
      clerkId: evt.data.id,
      email: evt.data.email_addresses[0]?.email_address,
      name: evt.data.first_name ? `${evt.data.first_name} ${evt.data.last_name}` : undefined,
    });
    break;
  case "user.deleted":
    await ctx.runMutation(internal.users.deleteUser, {
      clerkId: evt.data.id,
    });
    break;
}
By implementing this now, you're setting up a solid foundation for user management that integrates Clerk with Convex. This approach allows you to:
Store essential user data in your Convex database.
Keep your Convex user data in sync with Clerk.
Easily extend user data with additional fields specific to your application.


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

Configure ConvexProviderWithClerk
Now replace your ConvexProvider with ClerkProvider wrapping ConvexProviderWithClerk.

Pass the Clerk useAuth hook to the ConvexProviderWithClerk.

Paste the Publishable key as a prop to ClerkProvider.
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