import React, { useEffect } from 'react';
import { render, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CvLibraryProvider, useCvLibrary } from '../CvLibraryContext';

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
const LOCAL_STORAGE_KEY = 'cvLibrary';

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
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      configurable: true,
      writable: true,
    });
    // Reset mocked UUID counter so each test starts with mock-uuid-1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__mock_uuid_count = 0;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
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
      ctx.createNewCv();
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
      ctx.createNewCv();
    });
    await waitFor(() => expect(ctx.cvs.length).toBe(2));
    const secondId = ctx.currentCvId;

    // Switch back to first
    act(() => {
      ctx.loadCv(firstId);
    });
    expect(ctx.currentCvId).toBe(firstId);

    // Make an update to current cv to make it dirty
    const newState = { sections: [{ id: 's1', text: 'hello' }], source: 'manual', history: [] };
    act(() => {
      ctx.updateCurrentCv(newState);
    });

    // Immediately isDirty should be true because savedCvState hasn't been updated by debouncedSave yet
    await waitFor(() => expect(ctx.isDirty).toBe(true));

    // Attempt to load second while dirty - with autosave-on-switch we should persist and switch immediately
    let res: boolean | undefined;
    act(() => {
      res = ctx.loadCv(secondId);
    });
    expect(res).toBe(true);
    expect(ctx.currentCvId).toBe(secondId);

    // wait for debounced save to complete (use real timers)
    await new Promise((res) => setTimeout(res, parseInt(process.env.TEST_DEBOUNCE_MS || '1000', 10) + 50));
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
      const stored = JSON.parse(mockLocalStorage.getItem(LOCAL_STORAGE_KEY) as string);
      expect(stored[0].cvState).toEqual(newState);
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
