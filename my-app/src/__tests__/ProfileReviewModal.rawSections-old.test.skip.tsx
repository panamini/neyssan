import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock Clerk auth hook
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isSignedIn: true, isLoaded: true, getToken: async () => "fake-token" }),
}));

// Mock Convex mutation hook
vi.mock("convex/react", () => ({
  useMutation: () => (async (args: any) => ({ profileId: args.profileId, updatedAt: Date.now() })),
  useAction: () => undefined,
}));

// Minimal CVLoader mock (not used in these tests)
vi.mock("../components/CVLoader", () => ({
  __esModule: true,
  default: () => null,
}));

// Stub CVDocumentReviewer to avoid heavy rendering/timers that can stall the runner.
// We only need the overlay controls in this test.
vi.mock("../components/CVDocumentReviewer", () => ({
  __esModule: true,
  CVDocumentReviewer: ({ sections }: { sections: Array<{ id: string; title?: string; content?: string }> }) => {
    return (
      <div data-testid="cv-reviewer-stub">
        {Array.isArray(sections) ? sections.map((s) => (
          <div key={s.id}>
            <h4>{s.title ?? "Untitled"}</h4>
            <div>{s.content}</div>
          </div>
        )) : null}
      </div>
    );
  },
}));

import ProfileReviewModal from "../components/ProfileReviewModal";

describe("ProfileReviewModal — rawSections toggle and mapper-strip UI behavior", () => {
  it("shows rawSections when enabled and hides link-only sections when mapper stripping is disabled", async () => {
    // Build a parsedProfile with rawSections containing a link-only section and a summary
    const parsedProfile = {
      convexId: "cv-raw-1",
      name: "Alice Example",
      email: "alice@example.com",
      rawText: "Raw CV text...",
      version: 1,
      contact: {
        linkedinUrl: "https://linkedin.com/in/test-user"
      },
      // rawSections simulates the mapper's preserved array
      rawSections: [
        {
          title: "Contact",
          content: "linkedin.com/in/test-user",
          fieldKey: "contact",
          confidence: 0.8,
        },
        {
          title: "Summary",
          content: "Skilled engineer and tester.",
          fieldKey: "summary",
          confidence: 0.9,
        },
      ],
      metadata: {
        linkedinUrl: "https://linkedin.com/in/test-user"
      }
    };

    render(<ProfileReviewModal visible={true} parsedProfile={parsedProfile as any} onClose={() => {}} onSaved={() => {}} />);
 
    // Initially, the "Show raw sections" checkbox exists; enable it to render rawSections
    const showRawCheckbox = await screen.findByLabelText(/Show raw sections/i) as HTMLInputElement;
    expect(showRawCheckbox).toBeTruthy();
    fireEvent.click(showRawCheckbox);
 
    // By default "Use mapper stripping" is checked (true) in the UI we added.
    // When showRawSections is enabled and useMapperStripping is true, rawSections should be shown as-is.
    const rawLink = await screen.findByText(/linkedin\.com\/in\/test-user/i);
    expect(rawLink).toBeTruthy();
    const rawSummary = await screen.findByText(/Skilled engineer and tester/i);
    expect(rawSummary).toBeTruthy();
 
    // Now toggle "Use mapper stripping" OFF so the UI client-side dedupe runs and should hide link-only section
    const useMapperCheckbox = await screen.findByRole('checkbox', { name: /Use mapper stripping/i }) as HTMLInputElement;
    expect(useMapperCheckbox).toBeTruthy();
    // Click to change its state (the component toggles local boolean)
    fireEvent.click(useMapperCheckbox);
 
    // The link-only section should be removed from the displayed reviewer sections
    const reviewerPanel = screen.getByTestId('cv-reviewer-stub');
    // Wait for re-render: link-only section should be removed inside the reviewer stub
    await waitFor(() => {
      expect(within(reviewerPanel).queryByText(/linkedin\.com\/in\/test-user/i)).toBeNull();
    });
  });
});