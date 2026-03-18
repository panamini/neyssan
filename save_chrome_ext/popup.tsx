// src/popup.tsx
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from '@clerk/chrome-extension';
import React, { useEffect } from 'react';
import '../src/style.css';

const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const SYNC_HOST = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST;
const EXTENSION_URL = chrome.runtime.getURL('.');

if (!PUBLISHABLE_KEY || !SYNC_HOST) {
  throw new Error('Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY or PLASMO_PUBLIC_CLERK_SYNC_HOST in .env.development');
}

const Popup: React.FC = () => {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    const storeToken = async () => {
      const token = await getToken();
      if (token) {
        chrome.storage.local.set({ authToken: token }, () => {
          console.log("Auth token stored:", token);
        });
      } else {
        console.log("No token available");
      }
    };
    storeToken();
  }, [getToken]);

  const handleTestBackground = () => {
    console.log("Sending test message...");
    chrome.runtime.sendMessage({ action: "test" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Messaging error:", chrome.runtime.lastError.message);
        alert("Failed to communicate with background script. Check console.");
      } else if (response && response.success) {
        console.log("Test succeeded:", response);
        alert("Background script responded successfully!");
      } else {
        console.log("Unexpected response:", response);
        alert("Test failed. Check console.");
      }
    });
  };

  return (
    <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-h-[600px] plasmo-w-[400px] plasmo-flex-col">
      <header className="plasmo-w-full plasmo-text-center">
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>
      <main className="plasmo-grow plasmo-text-center">
        <SignedIn>
          <h2>Welcome!</h2>
          <p>You’re logged in. Use the extension on job sites.</p>
          <button
            onClick={handleTestBackground}
            className="plasmo-bg-blue-500 plasmo-text-white plasmo-px-4 plasmo-py-2 plasmo-rounded"
          >
            Test Background
          </button>
        </SignedIn>
      </main>
    </div>
  );
};

export default () => (
  <ClerkProvider
    publishableKey={PUBLISHABLE_KEY}
    syncHost={SYNC_HOST}
    afterSignOutUrl={`${EXTENSION_URL}/popup.html`}
    signInFallbackRedirectUrl={`${EXTENSION_URL}/popup.html`}
    signUpFallbackRedirectUrl={`${EXTENSION_URL}/popup.html`}
  >
    <Popup />
  </ClerkProvider>
);