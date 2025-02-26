import type { ReactNode } from 'react';
import { ConvexProvider as BaseConvexProvider, ConvexReactClient } from 'convex/react';

export type ConvexProviderProps = {
  readonly children: ReactNode;
};

const convex = new ConvexReactClient(import.meta.env['CONVEX_URL'] as string);

export function ConvexProvider({ children }: ConvexProviderProps): JSX.Element {
  return (
    <BaseConvexProvider client={convex}>
      {children}
    </BaseConvexProvider>
  );
}
