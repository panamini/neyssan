import type { ReactNode } from 'react';
import { ConvexProvider as BaseConvexProvider } from 'convex/react';
import { convexClient as convex } from '../lib/convex-client';

export type ConvexProviderProps = {
  readonly children: ReactNode;
};

export function ConvexProvider({ children }: ConvexProviderProps): JSX.Element {
  return (
    <BaseConvexProvider client={convex}>
      {children}
    </BaseConvexProvider>
  );
}
