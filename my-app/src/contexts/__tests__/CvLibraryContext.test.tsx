import React, { useEffect } from 'react';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CvLibraryProvider, useCvLibrary } from '../CvLibraryContext';
import { convexClient } from '../../lib/convex-client';
import { generateCvTemplateV1 } from '../../lib/cv-template';

const { authState, convexMutationMock } = vi.hoisted(() => ({
  authState: {
    isLoaded: false,
    isSignedIn: false,
    isConvexAuthenticated: false,
    isConvexAuthLoading: true,
  },
  convexMutationMock: vi.fn(async () => ({})),
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

vi.mock('convex/react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...(actual ?? {}),
    useMutation: () => convexMutationMock,
    useQuery: () => undefined,
    useAction: () => undefined,
    useConvexAuth: () => ({
      isAuthenticated:
        authState.isConvexAuthenticated ||
        (authState.isLoaded &&
          authState.isSignedIn &&
          !authState.isConvexAuthLoading),
      isLoading: authState.isConvexAuthLoading,
    }),
  };
});

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
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.isConvexAuthenticated = true;
    authState.isConvexAuthLoading = false;
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
    convexMutationMock.mockReset();
    convexMutationMock.mockResolvedValue({});
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

  it('restores the fresh full CV cache template ahead of a stale library index after refresh', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = false;

    const now = '2026-04-18T12:00:00.000Z';
    const staleIndexCv = {
      id: 'cv-template-refresh',
      title: 'Template Refresh CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        verbatiStyle: {
          familyId: 'workshop',
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
          resumeTemplateId: 'workshop_resume_onecol_ats',
        },
      },
      sections: [],
    };
    const freshCachedCv = {
      ...staleIndexCv,
      metadata: {
        ...staleIndexCv.metadata,
        verbatiStyle: {
          ...staleIndexCv.metadata.verbatiStyle,
          resumeTemplateId: 'sanat_asymmetric_resume',
        },
      },
    };

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([staleIndexCv]));
    mockLocalStorage.setItem(
      `cv:${freshCachedCv.id}`,
      JSON.stringify(freshCachedCv),
    );
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, freshCachedCv.id);
    window.history.pushState({}, '', `/cv?id=${freshCachedCv.id}`);

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(freshCachedCv.id));
    expect(ctx.currentCv.metadata.verbatiStyle.resumeTemplateId).toBe(
      'sanat_asymmetric_resume',
    );
  });

  it('replaces a stale full route cache with the authenticated canonical remote profile after refresh', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.isConvexAuthenticated = true;
    authState.isConvexAuthLoading = false;

    const localCv = generateCvTemplateV1('Stale Local Route CV');
    localCv.id = 'cv_route_canonical_remote';
    localCv.metadata = {
      ...localCv.metadata,
      updatedAt: '2026-04-18T12:00:00.000Z',
      verbatiStyle: {
        layout: 'classic',
        typography: 'inter',
        palette: 'graphite',
      } as any,
    };

    const remoteCv = generateCvTemplateV1('Canonical Remote Route CV');
    remoteCv.id = localCv.id;
    remoteCv.metadata = {
      ...remoteCv.metadata,
      updatedAt: '2026-04-18T12:02:00.000Z',
      verbatiStyle: {
        layout: 'workshop',
        typography: 'geist-baskervville',
        palette: 'sauge',
      } as any,
      documentDecoration: {
        visible: true,
        source: 'upload',
        assetId: 'storage_decoration_route',
        resolvedUrl: 'https://files.example.test/storage_decoration_route',
        fileName: 'mark.png',
        mimeType: 'image/png',
        sizePreset: 35,
        fit: 'contain',
        placementMode: 'default',
      } as any,
    };
    const summarySection = remoteCv.sections.find(
      (section: any) => section.type === 'summary',
    ) as any;
    summarySection.structuredContent = [
      {
        id: 'summary-route-remote',
        summary: 'Canonical remote text survives hard refresh.',
      },
    ];

    vi.mocked(convexClient.query).mockImplementation(async (_query: unknown, args: unknown) => {
      if ((args as { profileId?: string } | undefined)?.profileId === localCv.id) {
        return {
          profileId: localCv.id,
          cvDocument: remoteCv,
          metadata: remoteCv.metadata,
        };
      }
      return [];
    });

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([localCv]));
    mockLocalStorage.setItem(`cv:${localCv.id}`, JSON.stringify(localCv));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, localCv.id);
    window.history.pushState({}, '', `/cv?id=${localCv.id}`);

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>,
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(localCv.id));
    await waitFor(() => expect(ctx.currentCv.title).toBe(remoteCv.title));
    expect(JSON.stringify(ctx.currentCv)).toContain(
      'Canonical remote text survives hard refresh.',
    );
    expect(ctx.currentCv.metadata.verbatiStyle.layout).toBe('workshop');
    expect(ctx.currentCv.metadata.documentDecoration).toMatchObject({
      assetId: 'storage_decoration_route',
      resolvedUrl: 'https://files.example.test/storage_decoration_route',
    });
    expect(mockLocalStorage.getItem(`cv:${localCv.id}`)).toContain(
      'storage_decoration_route',
    );
  });

  it('refreshes runtime document decoration URLs for the restored active cv without a route id', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.isConvexAuthenticated = true;
    authState.isConvexAuthLoading = false;

    const localCv = generateCvTemplateV1('Cached Active Decoration CV');
    localCv.id = 'cv_active_decoration_cache';
    localCv.metadata = {
      ...localCv.metadata,
      updatedAt: '2026-04-18T12:00:00.000Z',
      documentDecoration: {
        visible: true,
        source: 'upload',
        assetId: 'storage_decoration_active',
        fileName: 'mark.png',
        mimeType: 'image/png',
        sizePreset: 35,
        fit: 'contain',
        placementMode: 'default',
      } as any,
    };

    const remoteCv = {
      ...localCv,
      metadata: {
        ...localCv.metadata,
        documentDecoration: {
          ...(localCv.metadata.documentDecoration as any),
          resolvedUrl: 'https://files.example.test/storage_decoration_active',
        },
      },
    };

    vi.mocked(convexClient.query).mockImplementation(async (_query: unknown, args: unknown) => {
      if ((args as { profileId?: string } | undefined)?.profileId === localCv.id) {
        return {
          profileId: localCv.id,
          cvDocument: remoteCv,
          metadata: remoteCv.metadata,
        };
      }
      return [];
    });

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([localCv]));
    mockLocalStorage.setItem(`cv:${localCv.id}`, JSON.stringify(localCv));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, localCv.id);
    window.history.pushState({}, '', '/cv');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>,
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(localCv.id));
    await waitFor(() =>
      expect(ctx.currentCv.metadata.documentDecoration).toMatchObject({
        assetId: 'storage_decoration_active',
        resolvedUrl: 'https://files.example.test/storage_decoration_active',
      }),
    );
  });

  it('overlays runtime decoration URLs when full background refresh is skipped by a newer local cache', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.isConvexAuthenticated = true;
    authState.isConvexAuthLoading = false;

    const localCv = generateCvTemplateV1('Local Newer Decoration CV');
    localCv.id = 'cv_active_decoration_newer_cache';
    localCv.metadata = {
      ...localCv.metadata,
      updatedAt: '2026-06-05T12:00:00.000Z',
      documentDecoration: {
        visible: true,
        source: 'upload',
        assetId: 'storage_decoration_runtime_overlay',
        fileName: 'mark.png',
        mimeType: 'image/png',
        sizePreset: 35,
        fit: 'contain',
        placementMode: 'default',
      } as any,
    };
    const localSectionsSnapshot = JSON.parse(JSON.stringify(localCv.sections));

    const remoteCv = {
      ...localCv,
      title: 'Remote Older Decoration CV',
      metadata: {
        ...localCv.metadata,
        updatedAt: '2026-06-05T11:00:00.000Z',
        documentDecoration: {
          ...(localCv.metadata.documentDecoration as any),
          resolvedUrl: 'https://files.example.test/storage_decoration_runtime_overlay',
        },
      },
    };

    vi.mocked(convexClient.query).mockImplementation(async (_query: unknown, args: unknown) => {
      if ((args as { profileId?: string } | undefined)?.profileId === localCv.id) {
        return {
          profileId: localCv.id,
          cvDocument: remoteCv,
          metadata: remoteCv.metadata,
        };
      }
      return [];
    });

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([localCv]));
    mockLocalStorage.setItem(`cv:${localCv.id}`, JSON.stringify(localCv));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, localCv.id);
    window.history.pushState({}, '', '/cv');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>,
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(localCv.id));
    await waitFor(() =>
      expect(ctx.currentCv.metadata.documentDecoration).toMatchObject({
        assetId: 'storage_decoration_runtime_overlay',
        resolvedUrl: 'https://files.example.test/storage_decoration_runtime_overlay',
      }),
    );
    expect(ctx.currentCv.title).toBe('Local Newer Decoration CV');
    expect(ctx.currentCv.sections).toEqual(localSectionsSnapshot);

    const localSnapshot = JSON.parse(
      mockLocalStorage.getItem(`cv:${localCv.id}`) as string,
    );
    expect(localSnapshot.metadata.updatedAt).toBe('2026-06-05T12:00:00.000Z');
    expect(localSnapshot.metadata.documentDecoration.resolvedUrl).toBeUndefined();
  });

  it('preserves remote visual metadata when weaker remote content is skipped', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.isConvexAuthenticated = true;
    authState.isConvexAuthLoading = false;

    const localCv = generateCvTemplateV1('Local Cached Workshop CV');
    localCv.id = 'cv_remote_weaker_visual_metadata';
    localCv.metadata = {
      ...localCv.metadata,
      updatedAt: '2026-06-05T12:00:00.000Z',
      verbatiStyle: {
        familyId: 'workshop',
        layout: 'workshop',
        typography: 'geist-baskervville',
        palette: 'sauge',
      } as any,
    };

    const remoteCv = {
      ...localCv,
      title: 'Remote Weaker Sanat CV',
      metadata: {
        ...localCv.metadata,
        updatedAt: '2026-06-05T11:59:00.000Z',
        resumeTemplateId: 'sanat_asymmetric_resume',
        verbatiStyle: {
          familyId: 'workshop',
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
          resumeTemplateId: 'sanat_asymmetric_resume',
        },
        verbatiStyleBaseSnapshot: {
          familyId: 'workshop',
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
          resumeTemplateId: 'sanat_asymmetric_resume',
        },
        documentStyleVersion: 3,
      },
      sections: localCv.sections.slice(0, 1),
    };

    vi.mocked(convexClient.query).mockImplementation(async (_query: unknown, args: unknown) => {
      if ((args as { profileId?: string } | undefined)?.profileId === localCv.id) {
        return {
          profileId: localCv.id,
          cvDocument: remoteCv,
          metadata: remoteCv.metadata,
        };
      }
      return [];
    });

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([localCv]));
    mockLocalStorage.setItem(`cv:${localCv.id}`, JSON.stringify(localCv));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, localCv.id);
    window.history.pushState({}, '', '/cv');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>,
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(localCv.id));
    await waitFor(() =>
      expect(ctx.currentCv.metadata.resumeTemplateId).toBe(
        'sanat_asymmetric_resume',
      ),
    );
    expect(ctx.currentCv.title).toBe('Local Cached Workshop CV');
    expect(ctx.currentCv.sections).toEqual(localCv.sections);
    expect(ctx.currentCv.metadata.verbatiStyle.resumeTemplateId).toBe(
      'sanat_asymmetric_resume',
    );
    expect(ctx.currentCv.metadata.verbatiStyleBaseSnapshot.resumeTemplateId).toBe(
      'sanat_asymmetric_resume',
    );
  });

  it('preserves the local selected template when background refresh returns newer content without visual metadata', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.isConvexAuthenticated = true;
    authState.isConvexAuthLoading = false;

    const localUpdatedAt = '2026-04-18T12:00:00.000Z';
    const remoteUpdatedAt = '2026-04-18T12:01:00.000Z';
    const localCv = {
      id: 'cv-template-background-refresh',
      title: 'Template Refresh CV',
      metadata: {
        createdAt: localUpdatedAt,
        updatedAt: localUpdatedAt,
        version: 1,
        resumeTemplateId: 'sanat_asymmetric_resume',
        verbatiStyle: {
          familyId: 'workshop',
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
          resumeTemplateId: 'sanat_asymmetric_resume',
        },
      },
      sections: [
        {
          id: 'profile-1',
          type: 'profile',
          title: 'Profile',
          blocks: [],
          structuredContent: [
            {
              id: 'profile-item-1',
              name: 'Template Candidate',
            },
          ],
        },
      ],
    };
    const remoteCv = {
      ...localCv,
      title: 'Template Refresh CV Remote',
      metadata: {
        createdAt: localUpdatedAt,
        updatedAt: remoteUpdatedAt,
        version: 1,
        verbatiStyle: {
          familyId: 'workshop',
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
        },
      },
    };
    const activeCv = {
      id: 'cv-active-before-template-refresh',
      title: 'Active Before Template Refresh',
      metadata: {
        createdAt: localUpdatedAt,
        updatedAt: localUpdatedAt,
        version: 1,
      },
      sections: [],
    };

    vi.mocked(convexClient.query).mockImplementation(async (_query: unknown, args: unknown) => {
      if (
        (args as { profileId?: string } | undefined)?.profileId ===
        'cv-template-background-refresh'
      ) {
        return {
          profileId: 'cv-template-background-refresh',
          cvDocument: remoteCv,
        };
      }
      return null;
    });

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([activeCv]));
    mockLocalStorage.setItem(`cv:${activeCv.id}`, JSON.stringify(activeCv));
    mockLocalStorage.setItem(`cv:${localCv.id}`, JSON.stringify(localCv));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, activeCv.id);
    window.history.pushState({}, '', `/cv?id=${activeCv.id}`);

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(activeCv.id));
    act(() => {
      window.history.pushState({}, '', `/cv?id=${localCv.id}`);
      ctx.loadCv(localCv.id);
    });
    await waitFor(() => expect(ctx.currentCvId).toBe(localCv.id));
    await waitFor(() => expect(ctx.currentCv.title).toBe(remoteCv.title));
    expect(ctx.currentCv.metadata.resumeTemplateId).toBe(
      'sanat_asymmetric_resume',
    );
    expect(ctx.currentCv.metadata.verbatiStyle.resumeTemplateId).toBe(
      'sanat_asymmetric_resume',
    );
  });

  it('does not let equal-content background refresh overwrite newer local style metadata', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.isConvexAuthenticated = true;
    authState.isConvexAuthLoading = false;

    const localCv = generateCvTemplateV1('Newer Local Style CV');
    localCv.id = 'cv-newer-local-style';
    localCv.metadata = {
      ...localCv.metadata,
      updatedAt: '2026-06-05T12:00:00.000Z',
      resumeTemplateId: 'workshop_resume_twocol_ats',
      verbatiStyle: {
        familyId: 'workshop',
        layout: 'workshop',
        typography: 'ledger-sans',
        palette: 'ink',
        resumeTemplateId: 'workshop_resume_twocol_ats',
      } as any,
      verbatiStyleBaseSnapshot: {
        familyId: 'workshop',
        layout: 'workshop',
        typography: 'ledger-sans',
        palette: 'ink',
        resumeTemplateId: 'workshop_resume_twocol_ats',
      } as any,
      documentStyleVersion: 1,
    };

    const remoteCv = {
      ...localCv,
      metadata: {
        ...localCv.metadata,
        updatedAt: '2026-06-05T11:59:00.000Z',
        resumeTemplateId: 'workshop_resume_onecol_ats',
        verbatiStyle: {
          familyId: 'workshop',
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
          resumeTemplateId: 'workshop_resume_onecol_ats',
        },
        verbatiStyleBaseSnapshot: {
          familyId: 'workshop',
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
          resumeTemplateId: 'workshop_resume_onecol_ats',
        },
        documentStyleVersion: 1,
      },
    };

    vi.mocked(convexClient.query).mockImplementation(async (_query: unknown, args: unknown) => {
      if ((args as { profileId?: string } | undefined)?.profileId === localCv.id) {
        return {
          profileId: localCv.id,
          cvDocument: remoteCv,
          metadata: remoteCv.metadata,
        };
      }
      return [];
    });

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([localCv]));
    mockLocalStorage.setItem(`cv:${localCv.id}`, JSON.stringify(localCv));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, localCv.id);
    window.history.pushState({}, '', '/cv');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>,
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(localCv.id));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(ctx.currentCv.metadata.resumeTemplateId).toBe(
      'workshop_resume_twocol_ats',
    );
    expect(ctx.currentCv.metadata.verbatiStyle.typography).toBe('ledger-sans');
    expect(ctx.currentCv.metadata.verbatiStyle.palette).toBe('ink');
  });

  it('createNewCv adds a CV, sets it current and persists to localStorage', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    let createdCv: any = null;
    act(() => {
      void ctx.createNewCv().then((result: any) => {
        createdCv = result;
      });
    });

    // Wait for provider to process state updates
    await waitFor(() => expect(ctx.cvs.length).toBe(1));
    await waitFor(() => expect(createdCv?.id).toBe(ctx.currentCvId));
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

  it('hydrates the remote CV library from saved cvDocument payloads for drawer visibility', async () => {
    const now = new Date().toISOString();
    const savedCv = {
      id: 'cv_remote_library_saved',
      title: 'Saved Imported CV',
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
          structuredContent: [
            {
              id: 'profile-item-1',
              name: 'Library Candidate',
              desiredPosition: 'Product Engineer',
            },
          ],
        },
        {
          id: 'summary-1',
          type: 'summary',
          title: 'Summary',
          blocks: [],
          structuredContent: [
            {
              id: 'summary-item-1',
              summary: 'Parsed import content should feed the drawer.',
            },
          ],
        },
      ],
    };

    vi.mocked(convexClient.query).mockImplementation(
      async (_ref: any, args?: any) => {
        if (args?.includeCvDocument === true) {
          return [
            {
              _id: 'profile_remote_library_saved',
              _creationTime: 100,
              profileId: 'cv_remote_library_saved',
              clerkId: 'clerk_123',
              email: 'fallback@example.com',
              name: 'Fallback Profile Name',
              version: 1,
              createdAt: 100,
              updatedAt: 200,
              preferences: {
                writingStyle: 'professional',
                tonePreference: 'formal',
                autoSend: false,
              },
              summary: 'Fallback profile summary',
              skills: [],
              experience: [],
              education: [],
              cvDocument: savedCv,
            },
          ];
        }
        return null;
      },
    );

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() =>
      expect(ctx.cvs.some((cv: any) => cv.id === 'cv_remote_library_saved')).toBe(
        true,
      ),
    );

    const hydrated = ctx.cvs.find(
      (cv: any) => cv.id === 'cv_remote_library_saved',
    );
    expect(vi.mocked(convexClient.query).mock.calls[0][1]).toEqual({
      includeCvDocument: true,
    });
    expect(hydrated.title).toBe('Saved Imported CV');
    expect(hydrated.sections.map((section: any) => section.type)).toEqual([
      'profile',
      'summary',
    ]);
  });

  it('falls back to a full save when style-only decoration save has no remote row', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await act(async () => {
      await ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.currentCvId).toBeTruthy());

    convexMutationMock.mockReset();
    convexMutationMock
      .mockResolvedValueOnce({
        written: false,
        reason: 'not_found_metadata_only',
      })
      .mockResolvedValueOnce({ written: true });

    await act(async () => {
      await ctx.saveCurrentCvStyleOnly(
        {
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
        },
        {
          documentDecoration: {
            visible: true,
            source: 'upload',
            assetId: 'storage_decoration_1',
            dataUrl: 'data:image/jpeg;base64,AAAA',
            fileName: 'mark.jpg',
            mimeType: 'image/jpeg',
            alt: 'Mark',
            sizePreset: 35,
            fit: 'contain',
            placementMode: 'custom',
            xMm: 17,
            yMm: 35,
          },
          documentStyleVersion: 1,
        },
      );
    });

    expect(convexMutationMock).toHaveBeenCalledTimes(2);
    expect(convexMutationMock.mock.calls[0][0].patch.cvDocument).toBeUndefined();
    expect(convexMutationMock.mock.calls[1][0].patch.cvDocument).toBeDefined();
    expect(
      convexMutationMock.mock.calls[1][0].patch.metadata.documentDecoration
        .assetId,
    ).toBe('storage_decoration_1');
    expect(
      convexMutationMock.mock.calls[1][0].patch.metadata.documentDecoration
        .dataUrl,
    ).toBeUndefined();
    expect(ctx.currentCv.metadata.documentDecoration.assetId).toBe(
      'storage_decoration_1',
    );
    expect(ctx.currentCv.metadata.documentDecoration.dataUrl).toBeUndefined();
    const localSnapshot = mockLocalStorage.getItem(`cv:${ctx.currentCvId}`);
    expect(localSnapshot).not.toContain('data:image');
    expect(JSON.parse(localSnapshot as string).metadata.documentDecoration).toMatchObject({
      assetId: 'storage_decoration_1',
      fileName: 'mark.jpg',
      mimeType: 'image/jpeg',
      visible: true,
    });
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

  it('mirrors imported CV content and style into the full cv cache immediately', async () => {
    const now = new Date().toISOString();
    const edited = {
      id: 'cv_edit_cache',
      title: 'Edited CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        verbatiStyle: {
          familyId: 'workshop',
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
          resumeTemplateId: 'workshop_resume_twocol_ats',
        },
      },
      sections: [
        {
          id: 'profile-1',
          type: 'profile',
          title: 'Profile',
          blocks: [],
          structuredContent: [{ id: 'profile-item-1', name: 'Ada Edited' }],
        },
        {
          id: 'summary-1',
          type: 'summary',
          title: 'Summary',
          blocks: [],
          structuredContent: [
            {
              id: 'summary-item-1',
              summary: 'Focused inline edit survives refresh.',
            },
          ],
        },
      ],
    };

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      void ctx.importCv(edited);
    });

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_edit_cache'));
    const cachedFull = JSON.parse(
      mockLocalStorage.getItem('cv:cv_edit_cache') as string,
    );
    expect(cachedFull.sections[0].structuredContent[0].name).toBe('Ada Edited');
    expect(
      JSON.stringify(cachedFull.sections[1].structuredContent[0].summary),
    ).toContain('Focused inline edit survives refresh.');
    expect(cachedFull.metadata.verbatiStyle.resumeTemplateId).toBe(
      'workshop_resume_twocol_ats',
    );

    const compactIndex = JSON.parse(
      mockLocalStorage.getItem(LOCAL_STORAGE_KEY) as string,
    );
    expect(compactIndex).toHaveLength(1);
    expect(compactIndex[0].id).toBe('cv_edit_cache');
    expect(compactIndex[0].metadata.librarySummaryOnly).toBe(true);
    expect(compactIndex[0].sections).toBeUndefined();
  });

  it('restores edited full cache over compact cvDocuments instead of expanding a blank V1 template', async () => {
    const now = new Date().toISOString();
    const compact = {
      id: 'cv_restore_edited',
      title: 'Edited CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        librarySummaryOnly: true,
      },
      profilePreview: {
        name: 'Ada Edited',
        desiredPosition: 'Engineer',
      },
    };
    const editedFull = {
      id: 'cv_restore_edited',
      title: 'Edited CV',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        verbatiStyle: {
          familyId: 'workshop',
          layout: 'workshop',
          typography: 'geist-baskervville',
          palette: 'sauge',
          resumeTemplateId: 'workshop_resume_twocol_ats',
        },
      },
      sections: [
        {
          id: 'profile-1',
          type: 'profile',
          title: 'Profile',
          blocks: [],
          structuredContent: [{ id: 'profile-item-1', name: 'Ada Edited' }],
        },
        {
          id: 'summary-1',
          type: 'summary',
          title: 'Summary',
          blocks: [],
          structuredContent: [
            {
              id: 'summary-item-1',
              summary: 'Edited summary from focused inline field.',
            },
          ],
        },
        {
          id: 'experience-1',
          type: 'experience',
          title: 'Experience',
          blocks: [],
          structuredContent: [
            {
              id: 'exp-item-1',
              company: 'Analytical Engine',
              responsibilities: 'Edited experience paragraph.',
            },
          ],
        },
      ],
    };

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([compact]));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, 'cv_restore_edited');
    mockLocalStorage.setItem('cv:cv_restore_edited', JSON.stringify(editedFull));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_restore_edited'));
    expect(ctx.currentCv.metadata?.librarySummaryOnly).not.toBe(true);
    expect(ctx.currentCv.sections.map((section: any) => section.type)).toEqual([
      'profile',
      'summary',
      'experience',
    ]);
    expect(ctx.currentCv.sections[1].structuredContent[0].summary).toBe(
      'Edited summary from focused inline field.',
    );
    expect(ctx.currentCv.sections[2].structuredContent[0].responsibilities).toBe(
      'Edited experience paragraph.',
    );
    expect(ctx.currentCv.metadata.verbatiStyle.resumeTemplateId).toBe(
      'workshop_resume_twocol_ats',
    );
  });

  it('persists typed summary and experience sections through updateCurrentCv and refresh hydration', async () => {
    let ctx: any;
    const view = render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await act(async () => {
      await ctx.createNewCv('Edited Route CV');
    });
    await waitFor(() => expect(ctx.currentCvId).toBeTruthy());

    const currentId = ctx.currentCvId;
    convexMutationMock.mockClear();
    const editedSections = ctx.currentCv.sections.map((section: any) => {
      if (section.type === 'summary') {
        return {
          ...section,
          structuredContent: [
            {
              id: 'summary-edited',
              summary: 'PERSIST_PROBE_TEST summary survives the hard refresh.',
            },
          ],
        };
      }
      if (section.type === 'experience') {
        return {
          ...section,
          structuredContent: [
            {
              id: 'experience-edited',
              company: 'Persistence Labs',
              position: 'Pipeline Lead',
              startDate: '2025-01-01',
              endDate: null,
              responsibilities:
                'PERSIST_PROBE_TEST experience survives the hard refresh.',
            },
          ],
        };
      }
      return section;
    });

    act(() => {
      ctx.updateCurrentCv({ sections: editedSections });
    });

    await waitFor(() =>
      expect(JSON.stringify(ctx.currentCv)).toContain(
        'PERSIST_PROBE_TEST summary survives the hard refresh.',
      ),
    );
    expect(JSON.stringify(ctx.currentCv)).toContain(
      'PERSIST_PROBE_TEST experience survives the hard refresh.',
    );
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await waitFor(() =>
      expect(
        convexMutationMock.mock.calls.some(([args]) =>
          Boolean((args as any)?.profileId),
        ),
      ).toBe(true),
    );
    const savePayload = convexMutationMock.mock.calls
      .filter(([args]) => Boolean((args as any)?.patch?.cvDocument))
      .at(-1)?.[0]?.patch;
    expect(savePayload?.cvDocument?.sections).toEqual(expect.any(Array));
    expect(JSON.stringify(savePayload?.cvDocument?.sections)).toContain(
      'PERSIST_PROBE_TEST summary survives the hard refresh.',
    );
    expect(JSON.stringify(savePayload?.cvDocument?.sections)).toContain(
      'PERSIST_PROBE_TEST experience survives the hard refresh.',
    );
    await waitFor(() =>
      expect(mockLocalStorage.getItem(`cv:${currentId}`)).toContain(
        'PERSIST_PROBE_TEST summary survives the hard refresh.',
      ),
    );

    view.unmount();
    window.history.pushState({}, '', `/cv?id=${currentId}`);

    let reloadedCtx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (reloadedCtx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(reloadedCtx.currentCvId).toBe(currentId));
    expect(JSON.stringify(reloadedCtx.currentCv)).toContain(
      'PERSIST_PROBE_TEST summary survives the hard refresh.',
    );
    expect(JSON.stringify(reloadedCtx.currentCv)).toContain(
      'PERSIST_PROBE_TEST experience survives the hard refresh.',
    );
  });

  it('does not let a newer blank remote cvDocument overwrite a locally edited route cv', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;

    const alpha = {
      id: 'cv_alpha',
      title: 'Alpha CV',
      metadata: {
        createdAt: '2026-06-04T08:00:00.000Z',
        updatedAt: '2026-06-04T08:00:00.000Z',
        version: 1,
      },
      sections: [],
    };
    const localEdited = generateCvTemplateV1('Edited Remote Race CV');
    localEdited.id = 'cv_remote_race';
    localEdited.metadata = {
      ...localEdited.metadata,
      createdAt: '2026-06-04T09:00:00.000Z',
      updatedAt: '2026-06-04T09:00:00.000Z',
      version: 1,
    };
    const localSummary = localEdited.sections.find(
      (section: any) => section.type === 'summary',
    ) as any;
    const localExperience = localEdited.sections.find(
      (section: any) => section.type === 'experience',
    ) as any;
    localSummary.structuredContent = [
      { id: 'summary-short', summary: 'A' },
    ];
    localExperience.structuredContent = [
      {
        id: 'experience-short',
        company: 'B',
        position: '',
        startDate: '2025-01-01',
        endDate: null,
        responsibilities: 'C',
      },
    ];

    const remoteBlank = generateCvTemplateV1('Edited Remote Race CV');
    remoteBlank.id = localEdited.id;
    remoteBlank.metadata = {
      ...remoteBlank.metadata,
      createdAt: '2026-06-04T09:00:00.000Z',
      updatedAt: '2026-06-04T09:05:00.000Z',
      version: 2,
    };

    let resolveRemote: ((value: unknown) => void) | null = null;
    vi.mocked(convexClient.query).mockImplementation(
      async (_reference: unknown, args?: Record<string, unknown>) => {
        if (args?.profileId === 'cv_remote_race') {
          return new Promise((resolve) => {
            resolveRemote = resolve;
          }) as Promise<any>;
        }
        return [];
      },
    );

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([alpha]));
    mockLocalStorage.setItem(`cv:${alpha.id}`, JSON.stringify(alpha));
    mockLocalStorage.setItem(`cv:${localEdited.id}`, JSON.stringify(localEdited));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, alpha.id);
    window.history.pushState({}, '', '/cv?id=cv_alpha');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(alpha.id));

    act(() => {
      window.history.pushState({}, '', `/cv?id=${localEdited.id}`);
      ctx.loadCv(localEdited.id);
    });

    await waitFor(() => expect(ctx.currentCvId).toBe(localEdited.id));
    expect(JSON.stringify(ctx.currentCv)).toContain('"summary":"A"');
    expect(JSON.stringify(ctx.currentCv)).toContain('"responsibilities":"C"');
    await waitFor(() => expect(resolveRemote).toBeTypeOf('function'));

    await act(async () => {
      resolveRemote?.({
        profileId: localEdited.id,
        cvDocument: remoteBlank,
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ctx.currentCvId).toBe(localEdited.id);
    expect(JSON.stringify(ctx.currentCv)).toContain('"summary":"A"');
    expect(JSON.stringify(ctx.currentCv)).toContain('"responsibilities":"C"');
    expect(mockLocalStorage.getItem(`cv:${localEdited.id}`)).toContain(
      '"summary":"A"',
    );
  });

  it('does not treat a pre-Convex-auth null route profile as an empty current cv', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.isConvexAuthLoading = true;
    authState.isConvexAuthenticated = false;

    const remoteCv = generateCvTemplateV1('Delayed Auth CV');
    remoteCv.id = 'cv_auth_delay';
    const summarySection = remoteCv.sections.find(
      (section: any) => section.type === 'summary',
    ) as any;
    summarySection.structuredContent = [
      {
        id: 'summary-auth-delay',
        summary: 'Remote text should load after Convex auth settles.',
      },
    ];

    vi.mocked(convexClient.query).mockImplementation(
      async (_reference: unknown, args?: Record<string, unknown>) => {
        if (args?.profileId === remoteCv.id) {
          return authState.isConvexAuthLoading
            ? null
            : {
                profileId: remoteCv.id,
                cvDocument: remoteCv,
              };
        }
        return [];
      },
    );

    window.history.pushState({}, '', `/cv?id=${remoteCv.id}`);

    let ctx: any;
    const view = render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>,
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.isLoading).toBe(false));
    expect(ctx.currentCvId).toBeNull();
    expect(mockLocalStorage.getItem(`cv:${remoteCv.id}`)).toBeNull();

    authState.isConvexAuthLoading = false;
    authState.isConvexAuthenticated = true;

    view.rerender(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>,
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(remoteCv.id));
    expect(JSON.stringify(ctx.currentCv)).toContain(
      'Remote text should load after Convex auth settles.',
    );
    expect(mockLocalStorage.getItem(`cv:${remoteCv.id}`)).toContain(
      'Remote text should load after Convex auth settles.',
    );
  });

  it('restores an existing local cv on the Clerk factor-one route without saving a blank template', async () => {
    authState.isLoaded = false;
    authState.isSignedIn = false;

    const localCv = generateCvTemplateV1('Factor One Local CV');
    localCv.id = 'cv_factor_one_local';
    const summarySection = localCv.sections.find(
      (section: any) => section.type === 'summary',
    ) as any;
    summarySection.structuredContent = [
      {
        id: 'summary-factor-one',
        summary: 'Local text should survive auth factor-one hydration.',
      },
    ];

    mockLocalStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify([
        {
          id: localCv.id,
          title: localCv.title,
          metadata: {
            ...localCv.metadata,
            librarySummaryOnly: true,
          },
          profilePreview: null,
        },
      ]),
    );
    mockLocalStorage.setItem(`cv:${localCv.id}`, JSON.stringify(localCv));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, localCv.id);
    window.history.pushState({}, '', '/sign-in/factor-one');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe(localCv.id));
    expect(JSON.stringify(ctx.currentCv)).toContain(
      'Local text should survive auth factor-one hydration.',
    );
    expect(mockLocalStorage.getItem(`cv:${localCv.id}`)).toContain(
      'Local text should survive auth factor-one hydration.',
    );
    const profilePatchCallsWhileAuthPending = convexMutationMock.mock.calls.filter(
      ([args]) => Boolean((args as any)?.profileId),
    );
    expect(profilePatchCallsWhileAuthPending).toHaveLength(0);
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

  it('applies an asynchronous remote cv load when switching from an active cv', async () => {
    const now = new Date().toISOString();
    const activeFull = {
      id: 'cv_active',
      title: 'Active Resume',
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
      ],
    };
    const compactTarget = {
      id: 'cv_remote_target',
      title: 'Remote Target',
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        librarySummaryOnly: true,
      },
      profilePreview: {
        name: 'Grace Hopper',
        desiredPosition: 'Engineering Manager',
      },
    };
    const remoteTarget = {
      id: 'cv_remote_target',
      title: 'Remote Target',
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
          structuredContent: [
            {
              id: 'profile-item-1',
              name: 'Grace Hopper',
              desiredPosition: 'Engineering Manager',
            },
          ],
        },
      ],
    };

    vi.mocked(convexClient.query).mockImplementation(async (_query: unknown, args: unknown) => {
      if ((args as { profileId?: string } | undefined)?.profileId === 'cv_remote_target') {
        return {
          profileId: 'cv_remote_target',
          cvDocument: remoteTarget,
        };
      }
      return null;
    });

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([activeFull, compactTarget]));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, 'cv_active');
    mockLocalStorage.setItem('cv:cv_active', JSON.stringify(activeFull));

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_active'));

    act(() => {
      ctx.loadCv('cv_remote_target');
    });

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_remote_target'));
    expect(ctx.currentCv.sections[0].structuredContent[0]).toMatchObject({
      name: 'Grace Hopper',
      desiredPosition: 'Engineering Manager',
    });
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

  it('does not fall back to another local cv while the requested /cv route id is still loading remotely', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;

    const beta = {
      id: 'cv_beta',
      title: 'Wrong Local CV',
      metadata: {
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };
    const routeCv = {
      id: 'cv_route',
      title: 'Requested Route CV',
      metadata: {
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([beta]));
    mockLocalStorage.setItem('cv:cv_beta', JSON.stringify(beta));
    mockLocalStorage.setItem('cvActiveId', 'cv_beta');
    window.history.pushState({}, '', '/cv?id=cv_route');

    let resolveRouteProfile: ((value: unknown) => void) | null = null;
    vi.mocked(convexClient.query).mockImplementation(
      async (_reference: unknown, args?: Record<string, unknown>) => {
        if (args?.profileId === 'cv_route') {
          return new Promise((resolve) => {
            resolveRouteProfile = resolve;
          }) as Promise<any>;
        }
        if (!args) {
          return [];
        }
        return null;
      },
    );

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx).toBeDefined());
    await waitFor(() => expect(resolveRouteProfile).toBeTypeOf('function'));
    expect(ctx.currentCvId).not.toBe('cv_beta');

    await act(async () => {
      resolveRouteProfile?.({ profileId: 'cv_route', cvDocument: routeCv });
    });

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_route'));
    expect(ctx.currentCv?.title).toBe('Requested Route CV');
    expect(mockLocalStorage.getItem('cvActiveId')).toBe('cv_route');
  });

  it('ignores a stale async route load when the user has switched to another cv', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;

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
        updatedAt: '2026-04-29T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([beta]));
    mockLocalStorage.setItem('cv:cv_beta', JSON.stringify(beta));
    window.history.pushState({}, '', '/cv?id=cv_alpha');

    let resolveAlpha: ((value: unknown) => void) | null = null;
    vi.mocked(convexClient.query).mockImplementation(
      async (_reference: unknown, args?: Record<string, unknown>) => {
        if (args?.profileId === 'cv_alpha') {
          return new Promise((resolve) => {
            resolveAlpha = resolve;
          }) as Promise<any>;
        }
        return null;
      },
    );

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(resolveAlpha).toBeTypeOf('function'));

    act(() => {
      window.history.pushState({}, '', '/cv?id=cv_beta');
      ctx.loadCv('cv_beta');
    });
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_beta'));

    await act(async () => {
      resolveAlpha?.({ profileId: 'cv_alpha', cvDocument: alpha });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ctx.currentCvId).toBe('cv_beta');
    expect(ctx.currentCv?.title).toBe('Beta CV');
    expect(mockLocalStorage.getItem('cvActiveId')).toBe('cv_beta');
  });

  it('does not let a background refresh for one cv replace the active route cv', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;

    const alpha = {
      id: 'cv_alpha',
      title: 'Alpha Local',
      metadata: {
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };
    const beta = {
      id: 'cv_beta',
      title: 'Beta Local',
      metadata: {
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-29T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };
    const refreshedBeta = {
      ...beta,
      title: 'Beta Remote Refresh',
      metadata: { ...beta.metadata, updatedAt: '2026-04-30T00:00:00.000Z' },
    };

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha]));
    mockLocalStorage.setItem('cv:cv_alpha', JSON.stringify(alpha));
    mockLocalStorage.setItem('cv:cv_beta', JSON.stringify(beta));
    mockLocalStorage.setItem('cvActiveId', 'cv_alpha');
    window.history.pushState({}, '', '/cv');

    let resolveBetaRefresh: ((value: unknown) => void) | null = null;
    vi.mocked(convexClient.query).mockImplementation(
      async (_reference: unknown, args?: Record<string, unknown>) => {
        if (args?.profileId === 'cv_beta') {
          return new Promise((resolve) => {
            resolveBetaRefresh = resolve;
          }) as Promise<any>;
        }
        return null;
      },
    );

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_alpha'));

    act(() => {
      window.history.pushState({}, '', '/cv?id=cv_beta');
      ctx.loadCv('cv_beta');
    });
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_beta'));
    await waitFor(() => expect(resolveBetaRefresh).toBeTypeOf('function'));

    act(() => {
      window.history.pushState({}, '', '/cv?id=cv_alpha');
      ctx.loadCv('cv_alpha');
    });
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_alpha'));

    await act(async () => {
      resolveBetaRefresh?.({
        profileId: 'cv_beta',
        cvDocument: refreshedBeta,
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ctx.currentCvId).toBe('cv_alpha');
    expect(ctx.currentCv?.title).toBe('Alpha Local');
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

  it('switches to a locally available cv without waiting for an outgoing remote save', async () => {
    const beta = {
      id: 'cv_beta',
      title: 'Beta CV',
      metadata: {
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
        version: 1,
      },
      sections: [
        {
          id: 'beta-summary',
          type: 'summary',
          title: 'Summary',
          blocks: [],
          structuredContent: [{ id: 'beta-summary-item', summary: 'Beta saved locally.' }],
        },
      ],
    };
    const imported = {
      id: 'cv_imported_pending',
      title: 'Imported Pending CV',
      metadata: {
        createdAt: '2026-04-29T00:00:00.000Z',
        updatedAt: '2026-04-29T00:00:00.000Z',
        version: 1,
      },
      sections: [
        {
          id: 'imported-summary',
          type: 'summary',
          title: 'Summary',
          blocks: [],
          structuredContent: [{ id: 'imported-summary-item', summary: 'Imported save is pending.' }],
        },
      ],
    };

    mockLocalStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([beta]));
    mockLocalStorage.setItem('cv:cv_beta', JSON.stringify(beta));
    let resolveRemoteSave: () => void = () => undefined;
    convexMutationMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRemoteSave = () => resolve({});
        }),
    );

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    act(() => {
      void ctx.importCv(imported);
    });
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_imported_pending'));

    await new Promise((resolve) =>
      setTimeout(
        resolve,
        parseInt(process.env.TEST_DEBOUNCE_MS || '1000', 10) + 50,
      ),
    );
    await waitFor(() => expect(convexMutationMock).toHaveBeenCalled());

    act(() => {
      ctx.loadCv('cv_beta');
    });
    await waitFor(() => expect(ctx.currentCvId).toBe('cv_beta'));

    act(() => {
      resolveRemoteSave();
    });
  });

  it('autosaves the outgoing cv under its own id when the route changes before debounce', async () => {
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
        updatedAt: '2026-04-29T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha, beta]));
    mockLocalStorage.setItem('cv:cv_alpha', JSON.stringify(alpha));
    mockLocalStorage.setItem('cv:cv_beta', JSON.stringify(beta));
    window.history.pushState({}, '', '/cv?id=cv_alpha');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_alpha'));

    act(() => {
      ctx.updateCurrentCv({
        sections: [{ id: 'legacy-section', text: 'alpha dirty edit' }],
        source: 'manual',
        history: [],
      });
      window.history.pushState({}, '', '/cv?id=cv_beta');
      ctx.loadCv('cv_beta');
    });

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_beta'));
    await waitFor(() => expect(convexMutationMock).toHaveBeenCalled());

    const savedProfileIds = convexMutationMock.mock.calls.map(
      ([args]) => args?.profileId,
    );
    expect(savedProfileIds).toContain('cv_alpha');
    expect(savedProfileIds).not.toContain('cv_beta');
    expect(JSON.parse(mockLocalStorage.getItem('cv:cv_alpha') as string).id).toBe(
      'cv_alpha',
    );
    expect(JSON.parse(mockLocalStorage.getItem('cv:cv_beta') as string).title).toBe(
      'Beta CV',
    );
  });

  it('mirrors dirty edits to the full local cache before remote debounce completes', async () => {
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

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha]));
    mockLocalStorage.setItem('cv:cv_alpha', JSON.stringify(alpha));
    window.history.pushState({}, '', '/cv?id=cv_alpha');

    let ctx: any;
    const view = render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_alpha'));

    act(() => {
      ctx.updateCurrentCv({
        sections: [{ id: 'legacy-section', text: 'dirty before debounce' }],
        source: 'manual',
        history: [],
      });
    });

    await waitFor(() =>
      expect(mockLocalStorage.getItem('cv:cv_alpha')).toContain(
        'dirty before debounce',
      ),
    );

    view.unmount();
    let reloadedCtx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (reloadedCtx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(reloadedCtx.currentCvId).toBe('cv_alpha'));
    expect(JSON.stringify(reloadedCtx.currentCv)).toContain(
      'dirty before debounce',
    );
    const profilePatchCallsWhileAuthPending = convexMutationMock.mock.calls.filter(
      ([args]) => Boolean((args as any)?.profileId),
    );
    expect(profilePatchCallsWhileAuthPending).toHaveLength(0);
  });

  it('keeps local dirty state and exposes remote failure when Convex rejects an oversized save', async () => {
    convexMutationMock.mockRejectedValue(
      new Error('Value is too large (1.04 MiB > maximum size 1 MiB)'),
    );

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

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha]));
    mockLocalStorage.setItem('cv:cv_alpha', JSON.stringify(alpha));
    window.history.pushState({}, '', '/cv?id=cv_alpha');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_alpha'));

    act(() => {
      ctx.renameCv('cv_alpha', 'Alpha Oversized Dirty');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    await waitFor(() => expect(convexMutationMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(ctx.remoteSaveStatus).toMatchObject({
        status: 'failed',
        documentId: 'cv_alpha',
        reason: 'convex_value_too_large',
      }),
    );
    expect(ctx.isDirty).toBe(true);
    expect(mockLocalStorage.getItem('cv:cv_alpha')).toContain(
      'Alpha Oversized Dirty',
    );
  });

  it('defers remote autosave while Convex auth is loading and flushes the latest local edit once ready', async () => {
    authState.isLoaded = true;
    authState.isSignedIn = true;
    authState.isConvexAuthLoading = true;
    authState.isConvexAuthenticated = false;

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

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha]));
    mockLocalStorage.setItem('cv:cv_alpha', JSON.stringify(alpha));
    mockLocalStorage.setItem('cvActiveId', 'cv_alpha');
    window.history.pushState({}, '', '/cv?id=cv_alpha');

    let ctx: any;
    const view = render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>,
    );

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_alpha'));

    act(() => {
      ctx.renameCv('cv_alpha', 'Alpha Auth Pending First');
      ctx.renameCv('cv_alpha', 'Alpha Auth Pending Latest');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    const profilePatchCallsWhileAuthPending = convexMutationMock.mock.calls.filter(
      ([args]) => Boolean((args as any)?.profileId),
    );
    expect(profilePatchCallsWhileAuthPending).toHaveLength(0);
    expect(mockLocalStorage.getItem('cv:cv_alpha')).toContain(
      'Alpha Auth Pending Latest',
    );
    expect(ctx.isDirty).toBe(true);

    authState.isConvexAuthLoading = false;
    authState.isConvexAuthenticated = true;

    view.rerender(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    await waitFor(() => {
      const profilePatchCalls = convexMutationMock.mock.calls.filter(([args]) =>
        Boolean((args as any)?.profileId),
      );
      expect(profilePatchCalls).toHaveLength(1);
    });
    const profilePatchCalls = convexMutationMock.mock.calls.filter(([args]) =>
      Boolean((args as any)?.profileId),
    );
    expect(profilePatchCalls[0][0]).toMatchObject({
      profileId: 'cv_alpha',
      patch: {
        cvDocument: expect.objectContaining({
          title: 'Alpha Auth Pending Latest',
        }),
      },
    });
  });

  it('prunes stale full cv caches when localStorage is full before dropping the active edit', async () => {
    const originalSetItem = mockLocalStorage.setItem;
    const alpha = {
      id: 'cv_alpha',
      title: 'Alpha CV',
      metadata: {
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
        version: 1,
      },
      sections: [
        {
          id: 'profile-alpha',
          type: 'profile',
          title: 'Profile',
          blocks: [],
          structuredContent: [
            {
              id: 'profile-item-alpha',
              name: 'Alpha Before',
            },
          ],
        },
      ],
    };
    const stale = {
      id: 'cv_stale_cache',
      title: 'Stale Cache CV',
      metadata: {
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha, stale]));
    mockLocalStorage.setItem('cv:cv_alpha', JSON.stringify(alpha));
    mockLocalStorage.setItem('cv:cv_stale_cache', JSON.stringify(stale));
    window.history.pushState({}, '', '/cv?id=cv_alpha');

    mockLocalStorage.setItem = (key: string, value: string) => {
      if (key === 'cv:cv_alpha' && storage['cv:cv_stale_cache']) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      originalSetItem(key, value);
    };

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_alpha'));

    const profileSection = ctx.currentCv.sections.find(
      (section: any) => section.type === 'profile',
    );
    act(() => {
      ctx.updateStructuredItem(profileSection.id, 'profile-item-alpha', {
        name: 'Alpha After Local Quota',
      });
    });

    await waitFor(() =>
      expect(mockLocalStorage.getItem('cv:cv_alpha')).toContain(
        'Alpha After Local Quota',
      ),
    );
    expect(mockLocalStorage.getItem('cv:cv_stale_cache')).toBeNull();
  });

  it('prunes stale full cv caches and retries when the compact library index is full', async () => {
    const originalSetItem = mockLocalStorage.setItem;
    const alpha = {
      id: 'cv_alpha',
      title: 'Alpha CV',
      metadata: {
        createdAt: '2026-04-28T00:00:00.000Z',
        updatedAt: '2026-04-28T00:00:00.000Z',
        version: 1,
      },
      sections: [
        {
          id: 'profile-alpha',
          type: 'profile',
          title: 'Profile',
          blocks: [],
          structuredContent: [
            {
              id: 'profile-item-alpha',
              name: 'Alpha Candidate',
            },
          ],
        },
      ],
    };
    const stale = {
      id: 'cv_stale_cache',
      title: 'Stale Cache CV',
      metadata: {
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
        version: 1,
      },
      sections: [],
    };

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha, stale]));
    mockLocalStorage.setItem('cv:cv_alpha', JSON.stringify(alpha));
    mockLocalStorage.setItem('cv:cv_stale_cache', JSON.stringify(stale));
    mockLocalStorage.setItem(ACTIVE_CV_STORAGE_KEY, 'cv_alpha');
    window.history.pushState({}, '', '/cv?id=cv_alpha');

    mockLocalStorage.setItem = (key: string, value: string) => {
      if (key === 'cvDocuments' && storage['cv:cv_stale_cache']) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      originalSetItem(key, value);
    };

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_alpha'));

    act(() => {
      ctx.renameCv('cv_alpha', 'Alpha Library Index Retry');
    });

    await waitFor(() =>
      expect(mockLocalStorage.getItem('cvDocuments')).toContain(
        'Alpha Library Index Retry',
      ),
    );
    expect(mockLocalStorage.getItem('cv:cv_alpha')).not.toBeNull();
    expect(mockLocalStorage.getItem('cv:cv_stale_cache')).toBeNull();
  });

  it('keeps local dirty state and exposes remote failure when Convex rejects profile authorization', async () => {
    convexMutationMock.mockRejectedValue(
      new Error('Not authorized to access this profile'),
    );

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

    mockLocalStorage.setItem('cvDocuments', JSON.stringify([alpha]));
    mockLocalStorage.setItem('cv:cv_alpha', JSON.stringify(alpha));
    window.history.pushState({}, '', '/cv?id=cv_alpha');

    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );

    await waitFor(() => expect(ctx.currentCvId).toBe('cv_alpha'));

    act(() => {
      ctx.renameCv('cv_alpha', 'Alpha Unauthorized Dirty');
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });

    await waitFor(() => expect(convexMutationMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(ctx.remoteSaveStatus).toMatchObject({
        status: 'failed',
        documentId: 'cv_alpha',
        reason: 'unauthorized',
      }),
    );
    expect(ctx.isDirty).toBe(true);
    expect(mockLocalStorage.getItem('cv:cv_alpha')).toContain(
      'Alpha Unauthorized Dirty',
    );
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

  it('importCv preserves explicit section order from CV Forge reordering', async () => {
    let ctx: any;
    render(
      <CvLibraryProvider>
        <TestConsumer setCtx={(c) => (ctx = c)} />
      </CvLibraryProvider>
    );
    await waitFor(() => expect(ctx).toBeDefined());

    await act(async () => {
      await ctx.importCv({
        id: 'reordered-cv',
        title: 'Reordered CV',
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1,
        },
        sections: [
          {
            id: 'sec-profile',
            title: 'Profile',
            type: 'profile',
            order: 0,
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
          {
            id: 'sec-skills',
            title: 'Skills',
            type: 'skills',
            order: 1,
            blocks: [],
            structuredContent: [{ id: 'skill-1', name: 'Roadmapping' }],
            collapsed: false,
          },
          {
            id: 'sec-experience',
            title: 'Experience',
            type: 'experience',
            order: 2,
            blocks: [],
            structuredContent: [
              {
                id: 'experience-1',
                position: 'Product Lead',
                company: 'Example Co',
              },
            ],
            collapsed: false,
          },
        ],
      });
    });

    await waitFor(() => expect(ctx.currentCv).not.toBeNull());
    expect(ctx.currentCv.sections.map((section: any) => section.id).slice(0, 3)).toEqual([
      'sec-profile',
      'sec-skills',
      'sec-experience',
    ]);
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
    const initialLibrarySize = ctx.cvs.length;
    act(() => {
      ctx.renameCv(currentId, 'My Custom CV');
    });
    await waitFor(() => expect(ctx.currentCv.title).toBe('My Custom CV'));
    expect(ctx.currentCvId).toBe(currentId);
    expect(ctx.cvs).toHaveLength(initialLibrarySize);
    expect(ctx.currentCv.metadata?.titleLocked).toBe(true);

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
    expect(ctx.cvs).toHaveLength(initialLibrarySize);
    expect(ctx.currentCvId).toBe(currentId);
  });

  it('does not auto-retitle a manually locked placeholder title or duplicate the CV', async () => {
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
    const initialLibrarySize = ctx.cvs.length;
    act(() => {
      ctx.renameCv(currentId, 'Imported CV');
    });
    await waitFor(() => expect(ctx.currentCv.title).toBe('Imported CV'));
    expect(ctx.currentCv.metadata?.titleLocked).toBe(true);

    const profileSection = ctx.currentCv.sections.find((section: any) => section.type === 'profile');
    const profileItem = profileSection.structuredContent[0];

    act(() => {
      ctx.updateStructuredItem(profileSection.id, profileItem.id, {
        name: 'Jane Doe',
        desiredPosition: 'Product Manager',
      });
    });

    await waitFor(() => expect(ctx.currentCv.title).toBe('Imported CV'));
    expect(ctx.currentCvId).toBe(currentId);
    expect(ctx.cvs).toHaveLength(initialLibrarySize);
    expect(ctx.cvs.filter((cv: any) => String(cv.id) === String(currentId))).toHaveLength(1);
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
