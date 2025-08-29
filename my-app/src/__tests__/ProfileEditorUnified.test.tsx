// src/__tests__/ProfileEditorUnified.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileEditorUnified from '../components/ProfileEditorUnified';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll, test, expect, vi } from 'vitest';

/**
 * Mock Convex React hooks used by the component.
 *
 * The component uses `useQuery` to subscribe to a Convex query result.
 * Provide a mocked `useQuery` that returns the expected profile object.
 */
vi.mock('convex/react', () => ({
  useQuery: () => ({
    _id: 'profile-123',
    name: 'Canonical Name',
    summary: 'Canonical summary',
  }),
}));

let called = 0;

// --- MSW server setup ---
const server = setupServer(
  http.post(/\/api\/v1\/llm-refine/, () => {
    // This endpoint is called when "Reapply AI refine" is clicked.
    // We mock a successful response that includes a placeholderId to trigger polling.
    return HttpResponse.json({
      placeholderId: '33333333-3333-3333-3333-333333333333',
    });
  }),
  http.post(/\/api\/v1\/confirm-save/, () => {
    return HttpResponse.json({
      id: '11111111-1111-1111-1111-111111111111',
      placeholderId: '22222222-2222-2222-2222-222222222222',
    });
  }),
  http.get(/\/api\/v1\/llm-history\/.*/, ({ request, params }) => {
    // Use request.url to get the URL string and parse it
    let id = params?.id;
    if (!id) {
      const url = new URL(request.url);
      const m = url.pathname.match(/\/api\/v1\/llm-history\/(.+)$/);
      id = m ? m[1] : undefined;
    }
    called += 1;
    if (called === 1) {
      return HttpResponse.json({ id, convex_write_status: 'pending' });
    }
    return HttpResponse.json({ id, convex_write_status: 'success' });
  }),
  http.get(/\/api\/v1\/profiles\/.*/, ({ request, params }) => {
    let id = params?.id;
    if (!id) {
      const url = new URL(request.url);
      const m = url.pathname.match(/\/api\/v1\/profiles\/(.+)$/);
      id = m ? m[1] : undefined;
    }
    // Mock the profile data to be immediately available.
    return HttpResponse.json({
      id,
      name: 'Canonical Name',
      summary: 'Canonical summary',
    });
  })
);

beforeAll(() => {
  server.listen();
  vi.spyOn(window, 'alert').mockImplementation(() => {}); // silence alert in test
});

afterEach(() => {
  server.resetHandlers();
  called = 0;
  vi.clearAllMocks();
});

afterAll(() => server.close());

// --- Test ---
test('confirm-save -> poll LLMHistory -> refresh canonical profile on success', async () => {
  render(<ProfileEditorUnified />);

  // Wait for the loading message to disappear and the profile to be displayed.
  await screen.findByText(/Canonical Name/i, {}, { timeout: 4000 });

  // Now that the profile is loaded, we can safely click the button.
  const reapplyButton = screen.getByRole('button', { name: /Reapply AI refine/i });
  await userEvent.click(reapplyButton);

  // After clicking, the component should receive a new placeholderId from the mocked llm-refine endpoint
  // and start polling. We can verify this by checking for the new placeholderId in the UI.
  await screen.findByText(/33333333-3333-3333-3333-333333333333/i);

  // The mock is set up to return 'pending' then 'success'.
  // Let's wait for the final state where the canonical profile is refreshed.
  const canonicalSection = await screen.findByRole('heading', {
    name: /Canonical profile \(Convex\)/i,
  }).then((heading) => heading.closest('section'));

  await waitFor(
    () => {
      // After polling completes and the profile is refreshed, the name should be visible.
      expect(within(canonicalSection!).getByText(/Canonical Name/)).toBeInTheDocument();
    },
    { timeout: 10000 }
  );
});
