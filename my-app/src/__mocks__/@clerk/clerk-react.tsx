/* eslint-disable react-refresh/only-export-components -- Existing mixed component/helper exports are outside this release-gate cleanup; split exports in a focused follow-up. */
export const useAuth = () => {
  return {
    isLoaded: true,
    isSignedIn: true,
    userId: "test-user-id",
    sessionId: "test-session",
    getToken: async (_opts?: any) => "fake-token",
    // Minimal extra properties often used in callers
    orgId: null,
    orgRole: null,
  };
};

export const ClerkProvider = ({ children }: { children: any }) => children;

export const SignInButton = ({ children }: { children: any }) => <>{children}</>;
export const SignUpButton = ({ children }: { children: any }) => <>{children}</>;
export const UserButton = ({ children }: { children: any }) => <>{children}</>;

export default {
  useAuth,
  ClerkProvider,
  SignInButton,
  SignUpButton,
  UserButton,
};