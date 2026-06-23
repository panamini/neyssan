/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React from "react";
/**
 * Minimal Convex react mock for tests.
 *
 * Export the commonly-used hooks with safe no-op implementations and ensure
 * the mutation mock exposes `withOptimisticUpdate` so code that inspects it
 * won't throw.
 */

export function useMutation(_ref?: any) {
  const call = async (..._args: any[]) => {
    // default mock resolves to undefined; individual tests override via vi.mock()
    return undefined;
  };
  // Provide the helper often expected by callers
  (call as any).withOptimisticUpdate = () => {};
  return call;
}

export function useAction(_ref?: any) {
  return undefined;
}

export function useQuery(_ref?: any, _args?: any) {
  return undefined;
}

export function useConvex() {
  // Provide a simple convex client shape used in some components
  return {
    mutation: async (_fn: any, ..._args: any[]) => undefined,
    query: async (_fn: any, ..._args: any[]) => undefined,
  };
}
// Auth components used in app markup
export const Authenticated = ({ children }: { children: any }) => children;
export const Unauthenticated = ({ children }: { children: any }) => children;


// Default export to be forgiving when imported as a module
export default {
  useMutation,
  useAction,
  useQuery,
  useConvex,
  Authenticated,
  Unauthenticated,
};