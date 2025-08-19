"use client";

import React from "react";
import { Authenticated, Unauthenticated, useConvex } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/clerk-react";
import { Flex } from "@radix-ui/themes";

import Header from "./components/header/Header";
import ProposalInputForm from "./components/ProposalInputForm";
import ProposalDisplay from "./components/ProposalDisplay";
import DarkModeToggle from "./components/dark-mode-toggle/DarkModeToggle";
import type { FormValues } from "./components/ProposalInputForm.schemas";

export default function App() {
  const [proposalContent, setProposalContent] = React.useState<string | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const convex = useConvex();
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();

  React.useEffect(() => {
    // Only attempt to create/update a profile once Clerk has loaded and the user is signed in.
    // This avoids "Not authenticated" errors when the client attempts mutations before
    // Clerk's session is available.
    if (!clerkLoaded || !isSignedIn) return;

    async function ensureUser() {
      try {
        // Use a runtime-any cast to avoid TypeScript issues when generated api types are stale.
        await convex.mutation((api as any).functions?.createUserFromClient as any);
        console.log('createUserFromClient OK');
      } catch (err) {
        console.error('createUserFromClient failed', err);
      }
    }

    ensureUser();
  }, [convex, isSignedIn, clerkLoaded]);

  const handleProposalSubmit = (
    _values: FormValues,
    proposal: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      setProposalContent(proposal);
    } catch (e: any) {
      setError(e.message || "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen">
      <Header />
      <div className="flex flex-row flex-grow">
        {/* Left Column */}
          <div className="flex flex-col items-center w-16 p-4">
          <Authenticated>
            <UserButton />
          </Authenticated>
          <DarkModeToggle />
        </div>

        {/* Main Content */}
        <main className="flex flex-col items-center justify-center flex-grow">
          <Flex direction="column" gap="4" align="center" className="w-full">
            <Unauthenticated>
              <Flex direction="column" gap="4" align="center" className="w-full max-w-md">
                <p>Log in to generate proposals</p>
                <SignInButton mode="modal">
                  <button className="px-4 py-2 rounded-md bg-foreground text-background">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-4 py-2 rounded-md bg-foreground text-background">
                    Sign up
                  </button>
                </SignUpButton>
              </Flex>
            </Unauthenticated>
            <Authenticated>
              <div className="relative w-full max-w-4xl px-4 mx-auto">
                <div className="h-[calc(100vh-12rem)] overflow-auto">
                  <ProposalDisplay proposalContent={proposalContent} loading={loading} error={error} />
                </div>
                <div className="sticky bottom-0 left-0 right-0 py-4 bg-background/95 dark:bg-background/90 backdrop-blur-md">
                  <ProposalInputForm onSubmit={handleProposalSubmit} />
                </div>
              </div>
            </Authenticated>
          </Flex>
        </main>
      </div>
    </div>
  );
}
