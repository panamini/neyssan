import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/chrome-extension';

const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const SYNC_HOST = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST ?? '';

export function RootLayout() {
  const navigate = useNavigate();

  if (!PUBLISHABLE_KEY || !SYNC_HOST) {
    console.error('Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY or PLASMO_PUBLIC_CLERK_SYNC_HOST');
    return <div>Error: Environment variables missing</div>;
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '400px', height: '600px', backgroundColor: '#fff' }}>
        <header style={{ width: '100%', textAlign: 'center', padding: '10px' }}>
          <SignedOut>
            <SignInButton mode="modal" />
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>
        <main style={{ flexGrow: 1, textAlign: 'center', padding: '20px' }}>
          <Outlet />
        </main>
      </div>
    </ClerkProvider>
  );
}