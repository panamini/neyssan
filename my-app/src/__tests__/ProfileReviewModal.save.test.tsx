import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock Clerk auth hook
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isSignedIn: true, isLoaded: true, getToken: async () => "fake-token" }),
}));

// Mock Convex mutation hook to simulate a successful save (returns profileId and updatedAt)
vi.mock("convex/react", () => ({
  useMutation: () => (async (args: any) => ({ profileId: args.profileId, updatedAt: Date.now() })),
  // Provide a no-op useAction so components importing it don't throw during tests.
  useAction: () => undefined,
}));

// Minimal CVLoader stub so tests can render the component (not used in this test)
vi.mock("../components/CVLoader", () => ({
  __esModule: true,
  default: ({ onFileParsed }: { onFileParsed: (p: any) => void }) => <button data-testid="cv-sim" onClick={() => onFileParsed({})}>Simulate CV Parse</button>,
}));

import ProfileReviewModal from "../components/ProfileReviewModal";

describe("ProfileReviewModal — save / canonical sync (migrated)", () => {
  it("saves draft and persists changes into the preview (immediate-apply semantics)", async () => {
    render(<ProfileReviewModal visible={true} parsedProfile={null} onClose={() => {}} />);

    // Find the draft summary card (left column) via its sr-only label "Summary (Draft)"
    const draftLabel = await screen.findByText(/Summary\s*\(Draft\)/i);
    const draftContainer = draftLabel.closest('div')!;

    // Click the Edit button for Summary to reveal the editable textarea
    const editButton = await screen.findByRole('button', { name: /Edit\s*Summary/i });
    fireEvent.click(editButton);

    // The editable textbox should appear inside the draft container
    const summary = within(draftContainer).getByRole('textbox');

    // Find the in-component "Save" button (editing footer)
    const saveBtn = screen.getByRole('button', { name: /Save/i });

    // Enter a draft value — Save should become enabled
    fireEvent.change(summary, { target: { value: "My new summary" } });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());

    // Click Save (this triggers the component's save flow)
    fireEvent.click(saveBtn);

    // After saving, the editor exits editing mode: the textarea should be gone
    await waitFor(() => expect(within(draftContainer).queryByRole('textbox')).toBeNull());

    // The draft preview should now show the new summary text
    await waitFor(() => expect(within(draftContainer).getByText(/My new summary/i)).toBeInTheDocument());
  });
});