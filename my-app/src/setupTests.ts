/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
// src/setupTests.ts
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Set the environment variable for the backend URL
vi.stubEnv('VITE_PDF_INGEST_URL', 'http://localhost:8000');
// Ensure Convex URL is absolute to avoid client bootstrap errors in tests
vi.stubEnv('VITE_CONVEX_URL', 'http://localhost:3001');

// Mock the global alert function to prevent it from appearing during tests
vi.stubGlobal('alert', vi.fn());
// Ensure Convex React tests don't fail when test files partially mock the library.
// Provide safe defaults for ConvexReactClient, Provider, and hooks used in code.
vi.mock('convex/react', async (importOriginal) => {
  const actualAny: any = await importOriginal();
  class ConvexReactClient {

    constructor(_url: string) {}
    // add no-op auth methods for compatibility
    async setAuth(_token: string | null) { return; }
    clearAuth() { /* noop */ }
  }
  const ConvexProvider = ({ children }: { children?: React.ReactNode }) => (children as any) ?? null;
  const ConvexProviderWithAuth = ConvexProvider;
  const resolved = async () => ({});
  return {
    ...(actualAny || {}),
    ConvexReactClient,
    ConvexProvider,
    ConvexProviderWithAuth,
    useConvex: () => ({}),
    useQuery: () => undefined,
    // Always stub to a safe no-op so tests never require ConvexProvider
    // and hooks like useAction don't throw provider errors.
    useMutation: () => resolved,
    useAction: () => undefined,
  };
});

// --- test environment polyfills & mocks ---

// Provide a safe fallback for CvLibraryContext consumers when tests render components
// outside of a CvLibraryProvider. We override only the hook to return a no-op context
// if the real hook throws due to a missing provider. When a provider is present,
// we defer to the actual implementation so full behavior remains intact.
const makeDefaultCvLibCtx = () => {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    cvs: [],
    currentCv: null,
    currentCvId: null,
    isLoading: false,
    isLibraryHydrated: true,
    lastLibraryFetchFailed: false,
    isDirty: false,
    loadCv: () => false,
    saveCurrentCv: asyncNoop,
    saveCurrentCvStyleOnly: asyncNoop,
    createCvFromState: noop,
    createNewCv: noop,
    importCv: asyncNoop,
    updateSectionTitle: noop,
    updateBlockTitle: noop,
    updateBlockContent: noop,
    addBlock: noop,
    deleteBlock: noop,
    reorderBlocks: noop,
    reorderSections: noop,
    addSection: noop,
    updateStructuredItem: noop,
    updateCurrentCv: noop,
    deleteCv: noop,
    renameCv: noop,
    registerFlushCallback: () => () => {},
    registerBlockFlushCallback: () => () => {},
    flushPendingEdits: noop,
    selectedInspector: null,
    openInspector: noop,
    closeInspector: noop,
    activeEditorBlockId: null,
    setActiveEditorBlockId: () => {},
    canUndo: false,
    canRedo: false,
    undo: noop,
    redo: noop,
  };
};

async function cvLibMockFactory(importOriginal: any) {
  try {
    const actual: any = await importOriginal();
    return {
      ...(actual || {}),
      useCvLibrary: () => {
        try {
          return actual.useCvLibrary();
        } catch {
          return makeDefaultCvLibCtx();
        }
      },
    };
  } catch {
    const defaultCtx = makeDefaultCvLibCtx();
    return {
      useCvLibrary: () => defaultCtx,
      CvLibraryProvider: ({ children }: { children?: React.ReactNode }) => (children as any) ?? null,
    };
  }
}

// Register mocks for all import specifier variants observed across the codebase
vi.mock('./contexts/CvLibraryContext', cvLibMockFactory);
vi.mock('../contexts/CvLibraryContext', cvLibMockFactory);
vi.mock('../../contexts/CvLibraryContext', cvLibMockFactory);
vi.mock('@/contexts/CvLibraryContext', cvLibMockFactory);

// Polyfill window.localStorage for tests that mount components reading it outside their own mocks
if (typeof window !== 'undefined' && (window as any).localStorage == null) {
  const store: Record<string, string> = {};
  const memoryStorage = {
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
  Object.defineProperty(window, 'localStorage', {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}
// matchMedia polyfill for components using responsive queries
if (typeof window !== 'undefined' && typeof (window as any).matchMedia !== 'function') {
  (window as any).matchMedia = (query: string) => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };
}

// ResizeObserver polyfill for components relying on measurements
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class {

    constructor(_cb: any) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Polyfill rAF/cAF to avoid components scheduling animation frames that keep the event loop alive.
if (typeof (globalThis as any).requestAnimationFrame !== 'function') {
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number;
}
if (typeof (globalThis as any).cancelAnimationFrame !== 'function') {
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id as unknown as NodeJS.Timeout);
}

// Track and clear timers/intervals created by components during tests so Vitest can exit cleanly.
// Some components (e.g., polling, debounced saves) create long-lived timers which prevent
// the test runner from finishing. We wrap setInterval/setTimeout and clear them after each test.
// This is intentionally conservative and only used in the test environment.
try {
  const trackedIntervals: Array<number | NodeJS.Timeout> = [];
  const trackedTimeouts: Array<number | NodeJS.Timeout> = [];
  const originalSetInterval = global.setInterval.bind(global);
  const originalSetTimeout = global.setTimeout.bind(global);
  // Override globals

  (global as any).setInterval = function (fn: any, ms?: any, ...args: any[]) {
    const id = originalSetInterval(fn, ms, ...args);
    try { trackedIntervals.push(id as any); } catch { /* noop */ }
    return id;
  };

  (global as any).setTimeout = function (fn: any, ms?: any, ...args: any[]) {
    const id = originalSetTimeout(fn, ms, ...args);
    try { trackedTimeouts.push(id as any); } catch { /* noop */ }
    return id;
  };

  // Ensure test framework hooks are available before calling afterEach
  // `afterEach` and `vi` are provided by Vitest via setupFiles.
  try {

    (global as any).afterEach(() => {
      try {
        for (const id of trackedIntervals.splice(0)) {
          try { clearInterval(id as any); } catch { /* noop */ }
        }
      } catch { /* noop */ }
      try {
        for (const id of trackedTimeouts.splice(0)) {
          try { clearTimeout(id as any); } catch { /* noop */ }
        }
      } catch { /* noop */ }
      try {
        // Clear fake timers if any test used them
        vi.clearAllTimers();
      } catch { /* vi may not be available in some environments */ }
    });
  } catch {
    // If afterEach isn't available yet, tests will still run; the global overrides above
    // will at least record timers and allow manual cleanup if needed.
  }
} catch {
  /* non-fatal in unusual test harnesses */
}

// Stable lucide-react icon mocks used by UI tests (e.g., Trash in SectionEditor)
vi.mock('lucide-react', async (importOriginal) => {
  // keep actual in case tests need other exports
  const actual: any = await importOriginal().catch(() => ({}));
  const Stub = ({ className }: { className?: string }) => null;
  // Provide a dynamic fallback so any missing icon export returns a stub
  const handler: ProxyHandler<any> = {
    get(target, prop: string) {
      if (prop in target) return target[prop as keyof typeof target];
      return Stub;
    }
  };
  const base = {
    ...actual,
    // common icons used across tests
    Pen: Stub,
    Pencil: Stub,
    PenLine: Stub,
    FileUser: Stub,
    PanelLeftDashed: Stub,
    FolderTree: Stub,
    Trash: Stub,
    Trash2: Stub,
    X: Stub,
    Plus: Stub,
    Mail: Stub,
    Phone: Stub,
    Linkedin: Stub,
    Globe: Stub,
    MapPin: Stub,
    UserRound: Stub,
    Briefcase: Stub,
  };
  return new Proxy(base, handler);
});
