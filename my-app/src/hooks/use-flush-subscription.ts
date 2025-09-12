import { useCallback, useEffect, useRef } from "react";
import { useCvLibrary } from "../contexts/CvLibraryContext";

interface UseFlushSubscriptionOptions {
  key: string | null | undefined;
  callback: () => void;
  enabled?: boolean;
}

/**
 * useFlushSubscription
 * - Registers a stable listener for a given key (e.g., "blk:{id}" or "sec:{id}") in CvLibraryContext.
 * - Uses a latest-ref pattern so the registered function identity is stable while the implementation updates.
 * - Prevents register/unregister churn from changing callback identities or frequent re-renders.
 */
export function useFlushSubscription(options: UseFlushSubscriptionOptions): void {
  const { key, callback, enabled = true } = options;
  const { registerBlockFlushCallback } = useCvLibrary();

  // Keep latest implementation
  const latestRef = useRef(callback);
  useEffect(() => {
    latestRef.current = callback;
  }, [callback]);

  // Stable wrapper identity
  const stableWrapper = useCallback(() => {
    try {
      latestRef.current();
    } catch {
      /* noop */
    }
  }, []);

  // Register once per key
  useEffect(() => {
    if (!enabled || !key) return;
    const unregister = registerBlockFlushCallback(key, stableWrapper);
    return () => {
      try {
        unregister();
      } catch {
        /* noop */
      }
    };
  }, [enabled, key, registerBlockFlushCallback, stableWrapper]);
}

export interface UseBlockFlushOptions {
  blockId: string | null | undefined;
  onFlush: () => void;
  enabled?: boolean;
}

export function useBlockFlushSubscription({ blockId, onFlush, enabled = true }: UseBlockFlushOptions): void {
  const key = blockId ? `blk:${String(blockId)}` : null;
  useFlushSubscription({ key, callback: onFlush, enabled });
}

export interface UseSectionFlushOptions {
  sectionId: string | null | undefined;
  onFlush: () => void;
  enabled?: boolean;
}

export function useSectionFlushSubscription({ sectionId, onFlush, enabled = true }: UseSectionFlushOptions): void {
  const key = sectionId ? `sec:${String(sectionId)}` : null;
  useFlushSubscription({ key, callback: onFlush, enabled });
}