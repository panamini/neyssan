/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  // Optional runtime override used by Convex HTTP handlers
  readonly CLIENT_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
