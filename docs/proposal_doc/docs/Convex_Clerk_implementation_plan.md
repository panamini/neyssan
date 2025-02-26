Core Provider Setup with Feature Flag
// src/lib/auth-provider.tsx
'use client';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexReactClient } from 'convex/react';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!;

export const AuthProvider = ({
  children,
  useOptimizedAuth,
}: {
  children: React.ReactNode;
  useOptimizedAuth: boolean;
}) => {
  if (useOptimizedAuth) {
    return (
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        tokenOptions={{ template: 'convex' }}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      </ClerkProvider>
    );
  }
  
  // Fallback to existing ManualAuthWrapper
  return <ManualAuthWrapper>{children}</ManualAuthWrapper>;
};
Server-Side Auth Handling
// src/pages/_app.tsx
import { AuthProvider } from '../lib/auth-provider';
import { withServerSideAuth } from '@clerk/nextjs/ssr';

export const getServerSideProps = withServerSideAuth(({ req }) => {
  return { props: { session: req.auth } };
});

export default function App({ Component, pageProps, session }) {
  return (
    <AuthProvider useOptimizedAuth={process.env.USE_OPTIMIZED_AUTH === 'true'}>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
Environment Configuration
// convex/auth.config.ts
export default {
  providers: [{
    domain: "https://prepared-grubworm-57.clerk.accounts.dev",
    applicationID: "convex",
  }]
};

// .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_CONVEX_URL=...
USE_OPTIMIZED_AUTH=true
Session Synchronization
// src/lib/session-sync.ts
import { useConvexAuth } from 'convex/react';
import { useSession } from '@clerk/nextjs';

export const useAuthSync = () => {
  const { isLoaded: convexLoaded, isAuthenticated } = useConvexAuth();
  const { session } = useSession();

  useEffect(() => {
    if (convexLoaded && session) {
      window.__clerk_debug__?.setSessionCookie(session.id);
    }
  }, [session, convexLoaded]);
};
Migration Testing Strategy
// src/__tests__/auth-migration.test.tsx
describe('Auth Migration', () => {
  test('JWT expiration handling', async () => {
    const { rerender } = render(<TestComponent />);
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 3600 * 1000);
    rerender(<TestComponent />);
    await waitFor(() => expect(mockConvexAuth).toHaveBeenCalled());
  });

  test('Fallback to ManualAuthWrapper', async () => {
    process.env.USE_OPTIMIZED_AUTH = 'false';
    const { container } = render(<App />);
    expect(container.querySelector('#manual-auth')).toBeTruthy();
  });
});
Next steps needed:

Implement cookie-based session storage
Add Convex auth validation middleware
Create migration rollback procedure
Update deployment scripts with new env vars