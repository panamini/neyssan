import React, { useEffect } from 'react';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CvLibraryProvider, useCvLibrary } from '../CvLibraryContext';
import { convexClient } from '../../lib/convex-client';

const { authState } = vi.hoisted(() => ({
  authState: {
    isLoaded: false,
    isSignedIn: false,
  },
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    isLoaded: authState.isLoaded,
    isSignedIn: authState.isSignedIn,
  }),
}));

vi.mock('../../lib/convex-client', () => ({
  convexClient: {
    query: vi.fn(async () => null),
    mutation: vi.fn(async () => null),
    action: vi.fn(async () => null),
    setAuth: vi.fn(async () => undefined),
    clearAuth: vi.fn(async () => undefined),
  },
}));

vi.mock('uuid', () => {
  return {
    v4: () => {
      // Attach counter to globalThis so tests can reset it in beforeEach
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      g.__mock_uuid_count = (g.__mock_uuid_count || 0) + 1;
      return `mock-uuid-${g.__mock_uuid_count}`;
    },
  };
});

// Key used by the provider
const LOCAL_STORAGE_KEY = 'cvDocuments';
const ACTIVE_CV_STORAGE_KEY = 'dasti:cv-library-current-id:v1';

function TestConsumer({ setCtx }: { setCtx: (c: any) => void }) {
  const ctx = useCvLibrary();
  useEffect(() => {
    setCtx(ctx);
  }, [ctx, setCtx]);
  return null;
}

describe('CvLibraryContext', () => {
  let storage: Record<string, string>;
  const mockLocalStorage = {
    get length() {
      return Object.keys(storage).length;
    },
    key: (index: number) => Object.keys(storage)[index] ?? null,
    getItem: (key: string) => (key in storage ? storage[key] : null),
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      storage = {};
    },
  };

  beforeEach(() => {
    // Reset in-memory storage and install mock
    storage = {};
    authState.isLoaded = false;
    authState.isSignedIn = false;
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
      writable: true,
    });
    // Reset mocked UUID counter so each test starts with mock-uuid-1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__mock_uuid_count = 0;
    vi.mocked(convexClient.query).mockReset();
    vi.mocked(convexClient.query).mockResolvedValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.pushState({}, '', '/');
    // restore localStorage to avoid polluting other tests (if any)
    delete (window as any).localStorage;
  });

  it('initializes with empty state when no localStorage value', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    // isLoading flips to false on mount effect
    await waitFor(() => expect(ctx.isLoading).toBe(false));
    expect(Array.isArray(ctx.cvs)).toBe(true);
    expect(ctx.cvs.length).toBe(0);
    expect(ctx.currentCvId).toBeNull();
    expect(ctx.currentCv).toBeNull();
  });

  it('marks the library hydrated for signed-out users once auth resolves', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = false;

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.isLibraryHydrated).toBe(true));
    expect(ctx.lastLibraryFetchFailed).toBe(false);
  });

  it('keeps the library unhydrated until signed-in remote reconciliation resolves and merges', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;

    let resolveRemoteProfiles: ((value: unknown[]) => void) | null = null;
    vi.mocked(convexClient.query).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRemoteProfiles = resolve as (value: unknown[]) => void;
        }) as Promise<any>,
    );

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    expect(ctx.isLibraryHydrated).toBe(false);
    expect(ctx.cvs).toHaveLength(0);

    act(() => {
      resolveRemoteProfiles?.([
        {
          _id: 'cv_remote_only',
          profileId: 'cv_remote_only',
          cvDocument: {
            id: 'cv_remote_only',
            title: 'Remote CV',
            metadata: {
              createdAt: '2026-04-17T09:00:00.000Z',
              updatedAt: '2026-04-17T09:00:00.000Z',
              version: 1,
            },
            sections: [
              {
                id: 'sec-profile-1',
                title: 'Profile',
                type: 'profile',
                blocks: [],
                structuredContent: [
                  {
                    id: 'profile-1',
                    name: 'Remote User',
                    desiredPosition: 'Designer',
                  },
                ],
                collapsed: false,
              },
            ],
          },
        },
      ]);
    });

    await waitFor(() => expect(ctx.isLibraryHydrated).toBe(true));
    expect(ctx.lastLibraryFetchFailed).toBe(false);
    expect(ctx.cvs).toHaveLength(1);
    expect(ctx.cvs[0].id).toBe('cv_remote_only');
  });

  it('treats signed-in remote fetch failures as hydrated but failed reconciliation', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    vi.mocked(convexClient.query).mockRejectedValueOnce(new Error('network down'));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.isLibraryHydrated).toBe(true));
    expect(ctx.lastLibraryFetchFailed).toBe(true);
    expect(ctx.cvs).toHaveLength(0);
  });

  it('resets hydration failure state on sign-out for the next auth cycle', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    vi.mocked(convexClient.query).mockRejectedValueOnce(new Error('network down'));

    let ctx: any;
    const { rerender } = render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.isLibraryHydrated).toBe(true));
    expect(ctx.lastLibraryFetchFailed).toBe(true);

    authState.isSignedIn = false;

    rerender(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.isLibraryHydrated).toBe(true));
    expect(ctx.lastLibraryFetchFailed).toBe(false);
  });

  it('initializes from localStorage when data exists', async () => {
    const now = new Date().toISOString();
    const initial = [
      {
        id: 'cv-123',
        title: 'Stored CV',
        createdAt: now,
        updatedAt: now,
        cvState: { sections: [], source: 'manual', history: [] },
      },
    ];
    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initial));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.isLoading).toBe(false));
    expect(ctx.cvs.length).toBe(1);
    expect(ctx.cvs[0].id).toBe('cv-123');
    expect(ctx.cvs[0].title).toBe('Stored CV');
  });

  it('restores the active CV id from the tiny persisted selection key', async () => {
    const now = '2026-04-17T12:00:00.000Z';
    const storedCv = {
      id: 'cv-active',
      title: 'Restored CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      sections: [
        {
          id: 'profile-cv-active',
          title: 'Profile',
          type: 'profile',
          blocks: [],
          structuredContent: [
            {
              id: 'profile-item-cv-active',
              name: 'Ada Lovelace',
            },
          ],
        },
      ],
    };
    const newerCv = {
      ...storedCv,
      id: 'cv-newer',
      title: 'Newer but inactive CV',
      metadata: {
        ...storedCv.metadata,
        updatedAt: '2026-04-18T12:00:00.000Z',
      },
    };
    mockLocalStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([
        {
          id: newerCv.id,
          title: newerCv.title,
          metadata: newerCv.metadata,
          profilePreview: { name: 'Grace Hopper' },
        },
        {
          id: storedCv.id,
          title: storedCv.title,
          metadata: storedCv.metadata,
          profilePreview: { name: 'Ada Lovelace' },
        },
      ]),
    );
    mockLocalStorage.setItem(`cv:${storedCv.id}`, JSON.stringify(storedCv));
    mockLocalStorage.setItem(`cv:${newerCv.id}`, JSON.stringify(newerCv));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, storedCv.id);
    window.history.pushState({}, '', '/cv');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe('cv-active'));
    expect(ctx.currentCv.title).toBe('Restored CV');
  });

  it('createNewCv adds a CV, sets it current and persists to localStorage', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    // create
    act(() => {
      ctx.createNewCv();
    });

    // Wait for provider to process state updates
    await waitFor(() => expect(ctx.cvs.length).toBe(1));
    expect(ctx.currentCvId).toBeTruthy();
    expect(ctx.currentCv).not.toBeNull();
    expect(ctx.currentCv.title).toMatch(/^Untitled CV/);

    // Verify persistence in localStorage
    const stored = JSON.parse(mockLocalStorage.getItem(LOCAL_STORAGE_KEY) as string);
    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBe(1);
    expect(stored[0].id).toBe(ctx.currentCvId);
    expect(Array.isArray(stored[0].sections)).toBe(false);
    expect(stored[0].metadata?.librarySummaryOnly).toBe(true);
  });

  it('hydrates a compact cvDocuments index but still loads the full cached cv document', async () => {
    const now = new Date().toISOString();
    const compact = {
      id: 'cv_compact',
      title: 'Compact CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        librarySummaryOnly: true,
      },
      profilePreview: {
        name: 'Ada Lovelace',
        desiredPosition: 'Engineer',
      },
    };
    const full = {
      id: 'cv_compact',
      title: 'Compact CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      sections: [
        {
          id: 'profile-1',
          type: 'profile',
          title: 'Profile',
          blocks: [],
          structuredContent: [{ id: 'profile-item-1', name: 'Ada Lovelace' }],
        },
        {
          id: 'summary-1',
          type: 'summary',
          title: 'Summary',
          blocks: [],
          structuredContent: [{ id: 'summary-item-1', summary: 'Full content' }],
        },
      ],
    };

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([compact]));
    mockLocalStorage.setItem('cv:cv_compact', JSON.stringify(full));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.cvs.length).toBe(1));

    act(() => {
      ctx.loadCv('cv_compact');
    });

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_compact'));
    expect(ctx.currentCv.sections.length).toBeGreaterThan(1);
    expect(ctx.currentCv.metadata?.librarySummaryOnly).not.toBe(true);
  });

  it('restores the active cv from full cached storage instead of the compact index on refresh', async () => {
    const now = new Date().toISOString();
    const compact = {
      id: 'cv_active',
      title: 'Active CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        librarySummaryOnly: true,
      },
      profilePreview: {
        name: 'Ada Lovelace',
        desiredPosition: 'Engineer',
      },
    };
    const full = {
      id: 'cv_active',
      title: 'Active CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      sections: [
        {
          id: 'profile-1',
          type: 'profile',
          title: 'Profile',
          blocks: [],
          structuredContent: [{ id: 'profile-item-1', name: 'Ada Lovelace' }],
        },
        {
          id: 'summary-1',
          type: 'summary',
          title: 'Summary',
          blocks: [],
          structuredContent: [{ id: 'summary-item-1', summary: 'Full content' }],
        },
        {
          id: 'experience-1',
          type: 'experience',
          title: 'Experience',
          blocks: [],
          structuredContent: [{ id: 'exp-item-1', company: 'Analytical Engine' }],
        },
      ],
    };

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([compact]));
    mockLocalStorage.setItem('cvActiveId', 'cv_active');
    mockLocalStorage.setItem('cv:cv_active', JSON.stringify(full));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_active'));
    await waitFor(() =>
      expect(ctx.currentCv.sections.map((section: any) => section.type)).toEqual([
        'profile',
        'summary',
        'experience',
      ]),
    );
    expect(ctx.currentCv.metadata?.librarySummaryOnly).not.toBe(true);
    expect(ctx.currentCv.sections[1].structuredContent[0].summary).toBe('Full content');
  });

  it('repairs a summary-only cached active cv back into the canonical five-section blank draft', async () => {
    const now = new Date().toISOString();
    const summaryOnlyDoc = {
      id: 'cv_summary_only',
      title: 'Untitled CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        librarySummaryOnly: true,
      },
      sections: [
        {
          id: 'profile-1',
          type: 'profile',
          title: 'Profile',
          blocks: [],
          structuredContent: [{ id: 'profile-item-1', name: '' }],
        },
      ],
    };

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([summaryOnlyDoc]));
    mockLocalStorage.setItem('cvActiveId', 'cv_summary_only');
    mockLocalStorage.setItem('cv:cv_summary_only', JSON.stringify(summaryOnlyDoc));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_summary_only'));
    expect(ctx.currentCv.sections.map((section: any) => section.type)).toEqual([
      'profile',
      'summary',
      'experience',
      'education',
      'skills',
    ]);
    expect(ctx.currentCv.metadata?.librarySummaryOnly).not.toBe(true);
  });

  it('restores the full remote cv when only a compact library entry survives locally', async () => {
    const now = new Date().toISOString();
    const compact = {
      id: 'cv_remote_only',
      title: 'Remote Resume',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        librarySummaryOnly: true,
      },
      profilePreview: {
        name: 'Ada Lovelace',
        desiredPosition: 'Engineer',
      },
    };
    const remoteFull = {
      id: 'cv_remote_only',
      title: 'Remote Resume',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      sections: [
        {
          id: 'profile-1',
          type: 'profile',
          title: 'Profile',
          blocks: [],
          structuredContent: [{ id: 'profile-item-1', name: 'Ada Lovelace' }],
        },
        {
          id: 'summary-1',
          type: 'summary',
          title: 'Summary',
          blocks: [],
          structuredContent: [{ id: 'summary-item-1', summary: 'Invented modern computing concepts.' }],
        },
        {
          id: 'experience-1',
          type: 'experience',
          title: 'Experience',
          blocks: [],
          structuredContent: [{ id: 'exp-item-1', company: 'Analytical Engine', title: 'Programmer' }],
        },
      ],
    };

    vi.mocked(convexClient.query).mockImplementation(async (_query: unknown, args: unknown) => {
      if ((args as { profileId?: string } | undefined)?.profileId === 'cv_remote_only') {
        return {
          profileId: 'cv_remote_only',
          cvDocument: remoteFull,
        };
      }
      return null;
    });

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([compact]));
    mockLocalStorage.setItem('cvActiveId', 'cv_remote_only');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_remote_only'));
    await waitFor(() =>
      expect(ctx.currentCv.sections.map((section: any) => section.type)).toEqual([
        'profile',
        'summary',
        'experience',
      ]),
    );
    expect(ctx.currentCv.metadata?.librarySummaryOnly).not.toBe(true);
    expect(ctx.currentCv.sections[1].structuredContent[0].summary).toBe(
      'Invented modern computing concepts.',
    );
    expect(
      JSON.parse(mockLocalStorage.getItem('cv:cv_remote_only') as string).sections[1]
        .structuredContent[0].summary,
    ).toBe('Invented modern computing concepts.');
  });

  it('loadCv sets the corresponding CV as currentCv', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    // Create two CVs
    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs.length).toBe(1));
    const firstId = ctx.currentCvId;
    act(() => {
      ctx.renameCv(firstId, 'First Resume');
    });
    await waitFor(() => expect(ctx.currentCv.title).toBe('First Resume'));

    await act(async () => {
      await ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs.length).toBe(2));
    const secondId = ctx.currentCvId;
    expect(secondId).not.toBe(firstId);

    // Load first
    act(() => {
      ctx.loadCv(firstId);
    });
    // loadCv sets currentCvId synchronously
    await waitFor(() => expect(ctx.currentCvId).toBe(firstId));
    expect(ctx.currentCv.id).toBe(firstId);
  });

  it('does not reshuffle visible CV recency when loading a summary-only entry from fallback cache', async () => {
    const olderUpdatedAt = '2024-04-08T09:00:00.000Z';
    const newerUpdatedAt = '2024-05-09T10:00:00.000Z';
    const compactOlder = {
      id: 'cv_older',
      title: 'Older Resume',
      metadata: {
        createdAt: olderUpdatedAt,
        updatedAt: olderUpdatedAt,
        version: 1,
        librarySummaryOnly: true,
      },
      profilePreview: {
        name: 'Older Candidate',
      },
    };
    const compactNewer = {
      id: 'cv_newer',
      title: 'Newer Resume',
      metadata: {
        createdAt: newerUpdatedAt,
        updatedAt: newerUpdatedAt,
        version: 1,
        librarySummaryOnly: true,
      },
      profilePreview: {
        name: 'Newer Candidate',
      },
    };

    mockLocalStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([compactOlder, compactNewer]),
    );
    mockLocalStorage.setItem(
      'cv:cv_older',
      JSON.stringify({
        id: 'cv_older',
        title: 'Older Resume',
        sections: 'invalid-sections-shape',
      }),
    );

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.cvs).toHaveLength(2));

    const sortVisibleIds = (docs: any[]) =>
      [...docs]
        .sort((left, right) => {
          const rightTime = new Date(
            right.metadata?.updatedAt ?? right.metadata?.createdAt ?? 0,
          ).getTime();
          const leftTime = new Date(
            left.metadata?.updatedAt ?? left.metadata?.createdAt ?? 0,
          ).getTime();
          return rightTime - leftTime;
        })
        .map((doc) => String(doc.id));

    expect(sortVisibleIds(ctx.cvs)).toEqual(['cv_newer', 'cv_older']);

    act(() => {
      ctx.loadCv('cv_older');
    });

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_older'));
    expect(sortVisibleIds(ctx.cvs)).toEqual(['cv_newer', 'cv_older']);
  });

  it('prefers the requested /cv route id over stale active storage during hydration', async () => {
    const now = new Date().toISOString();
    const alpha = {
      id: 'cv_alpha',
      title: 'Alpha CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      sections: [],
    };
    const beta = {
      id: 'cv_beta',
      title: 'Beta CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha, beta]));
    mockLocalStorage.setItem('cv:cv_alpha', JSON.stringify(alpha));
    mockLocalStorage.setItem('cv:cv_beta', JSON.stringify(beta));
    mockLocalStorage.setItem('cvActiveId', 'cv_alpha');
    window.history.pushState({}, '', '/cv?id=cv_beta');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_beta'));
    await waitFor(() =>
      expect(mockLocalStorage.getItem('cvActiveId')).toBe('cv_beta')
    );
    expect(ctx.currentCv?.title).toBe('Beta CV');
  });

  it('restores the most recently updated local cv when the active cv id is missing', async () => {
    const alpha = {
      id: 'cv_alpha',
      title: 'Alpha CV',
      metadata: {
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };
    const beta = {
      id: 'cv_beta',
      title: 'Beta CV',
      metadata: {
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha, beta]));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_beta'));
    expect(mockLocalStorage.getItem('cvActiveId')).toBe('cv_beta');
  });

  it('falls back to the most recently updated local cv when the stored active cv id is stale', async () => {
    const beta = {
      id: 'cv_beta',
      title: 'Beta CV',
      metadata: {
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([beta]));
    mockLocalStorage.setItem('cv:cv_beta', JSON.stringify(beta));
    mockLocalStorage.setItem('cvActiveId', 'cv_missing');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_beta'));
    expect(ctx.currentCv?.title).toBe('Beta CV');
    expect(mockLocalStorage.getItem('cvActiveId')).toBe('cv_beta');
  });

  it('clears the stored active cv id when no restorable cv exists', async () => {
    mockLocalStorage.setItem('cvActiveId', 'cv_missing');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.isLoading).toBe(false));
    expect(ctx.currentCvId).toBeNull();
    await waitFor(() => expect(mockLocalStorage.getItem('cvActiveId')).toBeNull());
  });

  it('migrates legacy library and doc cache keys into the current storage keys on mount', async () => {
    const now = new Date().toISOString();
    const alpha = {
      id: 'cv_alpha',
      title: 'Alpha CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cvLibrary', JSON.stringify([alpha]));
    mockLocalStorage.setItem('cv-doc:cv_alpha', JSON.stringify(alpha));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.cvs.length).toBe(1));
    expect(mockLocalStorage.getItem('cvDocuments')).toBeTruthy();
    expect(mockLocalStorage.getItem('cvLibrary')).toBeNull();
    expect(mockLocalStorage.getItem('cv:cv_alpha')).toBeTruthy();
    expect(mockLocalStorage.getItem('cv-doc:cv_alpha')).toBeNull();
  });

  it('removes orphan legacy cv-doc keys even when they are not present in cvDocuments', async () => {
    const now = new Date().toISOString();
    const orphan = {
      id: 'cv_orphan',
      title: 'Orphan CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cv-doc:cv_orphan', JSON.stringify(orphan));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() =>
      expect(mockLocalStorage.getItem('cv:cv_orphan')).toBeTruthy(),
    );
    expect(mockLocalStorage.getItem('cv-doc:cv_orphan')).toBeNull();
  });

  it('auto-persists when dirty and loadCv switches immediately', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    // create two cvs
    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs.length).toBe(1));
    const firstId = ctx.currentCvId;
    act(() => {
      ctx.renameCv(firstId, 'First Resume');
    });
    await waitFor(() => expect(ctx.currentCv.title).toBe('First Resume'));

    await act(async () => {
      await ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs.length).toBe(2));
    const secondId = ctx.currentCvId;

    // Switch back to first — loadCv is async (persists outgoing before switching)
    act(() => {
      ctx.loadCv(firstId);
    });
    await waitFor(() => expect(ctx.currentCvId).toBe(firstId));

    // Make an update to current cv to make it dirty
    const newState = { sections: [{ id: 's1', text: 'hello' }], source: 'manual', history: [] };
    act(() => {
      ctx.updateCurrentCv(newState);
    });

    // Immediately isDirty should be true because savedCvState hasn't been updated by debouncedSave yet
    await waitFor(() => expect(ctx.isDirty).toBe(true));

    // Attempt to load second while dirty — loadCv always persists outgoing async before switching,
    // so it returns false and the switch completes asynchronously.
    act(() => {
      ctx.loadCv(secondId);
    });
    await waitFor(() => expect(ctx.currentCvId).toBe(secondId));
    await waitFor(() => expect(ctx.isDirty).toBe(false));
  });

  it('deleteCv removes a CV and resets current if deleting active CV', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs.length).toBe(1));
    const id = ctx.currentCvId;

    // Delete active
    act(() => {
      ctx.deleteCv(id);
    });
    await waitFor(() => expect(ctx.cvs.length).toBe(0));
    expect(ctx.currentCvId).toBeNull();
    expect(ctx.currentCv).toBeNull();

    // Ensure persisted store updated
    const stored = mockLocalStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : null;
    expect(parsed === null || parsed.length === 0).toBe(true);
  });

  it('updateCurrentCv updates live state immediately and persists after debounce', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs.length).toBe(1));

    const newState = { sections: [{ id: 's1', text: 'updated' }], source: 'manual', history: [] };
    act(() => {
      ctx.updateCurrentCv(newState);
    });

    // Immediate UI update: currentCv should reflect new state
    expect(ctx.currentCv.cvState).toEqual(newState);

    // Skip asserting pre-debounce persistence to avoid flakiness
    // (we assert persistence after advancing timers below)

    // Wait for debounce to elapse (use real timers)
    await new Promise((res) => setTimeout(res, parseInt(process.env.TEST_DEBOUNCE_MS || '1000', 10) + 50));
    
    // Wait for effect to persist updated cvs
    await waitFor(() => {
      const indexStored = JSON.parse(
        mockLocalStorage.getItem(LOCAL_STORAGE_KEY) as string,
      );
      const fullStored = JSON.parse(
        mockLocalStorage.getItem(`cv:${ctx.currentCvId}`) as string,
      );
      expect(indexStored[0].cvState).toBeUndefined();
      expect(fullStored.id).toBe(ctx.currentCvId);
      expect(fullStored.cvState).toBeUndefined();
    });
  });

  it('renameCv updates the title and persists the change', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs.length).toBe(1));
    const id = ctx.currentCvId;

    act(() => {
      ctx.renameCv(id, 'My New CV Title');
    });
    await waitFor(() => expect(ctx.cvs[0].title).toBe('My New CV Title'));

    const stored = JSON.parse(mockLocalStorage.getItem(LOCAL_STORAGE_KEY) as string);
    expect(stored[0].title).toBe('My New CV Title');
  });

  it('reorderSections derives a title for upload-created CVs when no current CV exists', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.reorderSections([
        {
          id: 'sec-profile-1',
          title: 'Profile',
          type: 'profile',
          blocks: [],
          structuredContent: [
            {
              id: 'profile-1',
              name: 'Jane Doe',
              desiredPosition: 'Product Manager',
              email: 'jane@example.com',
            },
          ],
          collapsed: false,
        },
      ]);
    });

    await waitFor(() => expect(ctx.currentCv).not.toBeNull());
    expect(ctx.currentCv.title).toBe('Jane Doe — Product Manager');
  });

  it('importCv derives a title when the incoming document still has a placeholder title', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    await act(async () => {
      await ctx.importCv({
        id: 'imported-cv-1',
        title: 'Imported CV',
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        },
        sections: [
          {
            id: 'sec-profile-1',
            title: 'Profile',
            type: 'profile',
            blocks: [],
            structuredContent: [
              {
                id: 'profile-1',
                name: 'Jane Doe',
                desiredPosition: 'Product Manager',
                email: 'jane@example.com',
              },
            ],
            collapsed: false,
          },
        ],
      });
    });

    await waitFor(() => expect(ctx.currentCv).not.toBeNull());
    expect(ctx.currentCv.title).toBe('Jane Doe — Product Manager');
    expect(ctx.cvs[0].title).toBe('Jane Doe — Product Manager');
  });

  it('preserves authoritative resume metadata through import, save, and load', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    const authoritativeResume = {
      source: 'mistral_v3',
      trusted: true,
      fallbackToLegacy: false,
      normalized: {
        profile: {
          name: 'Jane Doe',
        },
      },
    };

    await act(async () => {
      await ctx.importCv({
        id: 'imported-cv-authoritative',
        title: 'Imported CV',
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
          authoritativeResume,
        },
        sections: [
          {
            id: 'sec-profile-1',
            title: 'Profile',
            type: 'profile',
            blocks: [],
            structuredContent: [
              {
                id: 'profile-1',
                name: 'Jane Doe',
                desiredPosition: 'Product Manager',
              },
            ],
            collapsed: false,
          },
        ],
      });
    });

    await waitFor(() => expect(ctx.currentCv?.metadata?.authoritativeResume).toEqual(authoritativeResume));

    const cachedDocument = JSON.parse(
      mockLocalStorage.getItem('cv:imported-cv-authoritative') as string,
    );
    expect(cachedDocument.metadata.authoritativeResume).toEqual(authoritativeResume);

    cleanup();

    let reloadedCtx: any;
    mockLocalStorage.setItem('cvActiveId', 'imported-cv-authoritative');
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (reloadedCtx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(reloadedCtx).toBeDefined());
    await waitFor(() =>
      expect(reloadedCtx.currentCv?.metadata?.authoritativeResume).toEqual(
        authoritativeResume,
      ),
    );
  });

  it('auto-retitles a blank CV when uploaded sections provide profile metadata', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.currentCv).not.toBeNull());
    expect(ctx.currentCv.title).toBe('Untitled CV');

    act(() => {
      ctx.reorderSections([
        {
          id: 'sec-profile-1',
          title: 'Profile',
          type: 'profile',
          blocks: [],
          structuredContent: [
            {
              id: 'profile-1',
              name: 'Jane Doe',
              desiredPosition: 'Product Manager',
              email: 'jane@example.com',
            },
          ],
          collapsed: false,
        },
      ]);
    });

    await waitFor(() => expect(ctx.currentCv.title).toBe('Jane Doe — Product Manager'));
  });

  it('auto-retitles a blank CV when profile structured data is edited in later', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.currentCv).not.toBeNull());
    expect(ctx.currentCv.title).toBe('Untitled CV');

    const profileSection = ctx.currentCv.sections.find((section: any) => section.type === 'profile');
    const profileItem = profileSection.structuredContent[0];

    act(() => {
      ctx.updateStructuredItem(profileSection.id, profileItem.id, {
        name: 'Jane Doe',
        desiredPosition: 'Product Manager',
      });
    });

    await waitFor(() => expect(ctx.currentCv.title).toBe('Jane Doe — Product Manager'));
    expect(ctx.cvs[0].title).toBe('Jane Doe — Product Manager');
  });

  it('preserves a manually renamed title when later profile metadata is edited in', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.currentCv).not.toBeNull());

    const currentId = ctx.currentCvId;
    act(() => {
      ctx.renameCv(currentId, 'My Custom CV');
    });
    await waitFor(() => expect(ctx.currentCv.title).toBe('My Custom CV'));

    const profileSection = ctx.currentCv.sections.find((section: any) => section.type === 'profile');
    const profileItem = profileSection.structuredContent[0];

    act(() => {
      ctx.updateStructuredItem(profileSection.id, profileItem.id, {
        name: 'Jane Doe',
        desiredPosition: 'Product Manager',
      });
    });

    await waitFor(() => expect(ctx.currentCv.title).toBe('My Custom CV'));
    expect(ctx.cvs[0].title).toBe('My Custom CV');
  });

  it('promotes a meaningful current CV before replacing it with a fresh draft', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.currentCv).not.toBeNull());

    const firstId = ctx.currentCvId;
    const unregister = ctx.registerFlushCallback(() => {
      ctx.renameCv(firstId, 'Jane Doe — Product Manager');
    });

    await act(async () => {
      await ctx.createNewCv();
    });

    unregister();

    await waitFor(() => expect(ctx.cvs.length).toBe(2));
    expect(ctx.currentCvId).not.toBe(firstId);
    expect(ctx.currentCv.title).toBe('Untitled CV');
    expect(
      ctx.cvs.find((doc: any) => doc.id === firstId)?.title,
    ).toBe('Jane Doe — Product Manager');
  });

  it('drops an untouched placeholder draft before creating a fresh replacement', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.currentCv).not.toBeNull());

    const firstId = ctx.currentCvId;

    await act(async () => {
      await ctx.createNewCv();
    });

    await waitFor(() => expect(ctx.cvs.length).toBe(1));
    expect(ctx.currentCvId).not.toBe(firstId);
    expect(
      JSON.parse(mockLocalStorage.getItem(LOCAL_STORAGE_KEY) as string),
    ).toHaveLength(1);
  });
});
// Undo/Redo unit tests
it('undo/redo pushes previous states and restores correctly', async () => {
  let ctx: any;
  render(
    <CvLibraryProvider>
      <TestConsumer setCtx={(c) => (ctx = c)} />
    </CvLibraryProvider>
  );
  await waitFor(() => expect(ctx).toBeDefined());

  // Create a CV and capture its initial state
  act(() => {
    ctx.createNewCv();
  });
  await waitFor(() => expect(ctx.cvs.length).toBe(1));
  const id = ctx.currentCvId;
  const initialState = JSON.parse(JSON.stringify(ctx.currentCv.cvState));

  // First update -> should push previous state onto undo stack
  const stateA = { sections: [{ id: 'a1', text: 'first' }], source: 'manual', history: [] };
  act(() => {
    ctx.updateCurrentCv(stateA);
  });

  // Immediately the live state should reflect the new state
  expect(ctx.currentCv.cvState).toEqual(stateA);
  // canUndo should now be true
  await waitFor(() => expect(ctx.canUndo).toBe(true));

  // Undo should restore initialState
  act(() => {
    ctx.undo();
  });
  await waitFor(() => expect(ctx.currentCv.cvState).toEqual(initialState));
  // After undo, redo should be available
  expect(ctx.canRedo).toBe(true);

  // Redo should re-apply stateA
  act(() => {
    ctx.redo();
  });
  await waitFor(() => expect(ctx.currentCv.cvState).toEqual(stateA));
  expect(ctx.canUndo).toBe(true);

  // After an undo followed by a new edit, redo should be cleared
  act(() => {
    ctx.undo();
  });
  await waitFor(() => expect(ctx.canRedo).toBe(true));
  const stateB = { sections: [{ id: 'b1', text: 'second' }], source: 'manual', history: [] };
  act(() => {
    ctx.updateCurrentCv(stateB);
  });
  // Redo cleared
  expect(ctx.canRedo).toBe(false);
  // And current state equals stateB
  expect(ctx.currentCv.cvState).toEqual(stateB);
});
