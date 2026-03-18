import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock Clerk auth hook (required so ProfileReviewModal sees clerkLoaded === true)
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isSignedIn: true, isLoaded: true, getToken: async () => "fake-token" }),
}));

// Mock Clerk auth hook
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isSignedIn: true, isLoaded: true, getToken: async () => "fake-token" }),
}));



// Stub CVDocumentReviewer to avoid heavy rendering/timers that can stall the runner.
// We only need the overlay controls in this test.
vi.mock("../components/CVDocumentReviewer", () => ({
  __esModule: true,
  CVDocumentReviewer: ({ sections }: { sections: Array<{ id: string; title?: string; content?: string }> }) => {
    return (
      <div data-testid="cv-reviewer-stub">
        {Array.isArray(sections)
          ? sections.map((s) => (
              <div key={s.id}>
                <h4>{s.title ?? "Untitled"}</h4>
                <div>{s.content}</div>
              </div>
            ))
          : null}
      </div>
    );
  },
}));


describe("ProfileReviewModal — rawSections toggle behavior (current semantics)", () => {
  it("renders rawSections when 'Show raw sections' is enabled and keeps link-only sections visible (mapper stripping has no effect on raw)", async () => {
    // Build a parsedProfile with rawSections containing a link-only section and a summary
    const parsedProfile = {
      convexId: "cv-raw-1",
      name: "Alice Example",
      email: "alice@example.com",
      rawText: "Raw CV text...",
      version: 1,
      contact: {
        linkedinUrl: "https://linkedin.com/in/test-user",
      },
      // rawSections simulates the mapper's preserved array
      rawSections: [
        {
          id: "contact-0",
          title: "Contact",
          content: "linkedin.com/in/test-user",
          fieldKey: "contact",
          confidence: 0.8,
        },
        {
          id: "summary-0",
          title: "Summary",
          content: "Skilled engineer and tester.",
          fieldKey: "summary",
          confidence: 0.9,
        },
      ],
      metadata: {
        linkedinUrl: "https://linkedin.com/in/test-user",
      },
    };

    const { default: ProfileReviewModal } = await import("../components/ProfileReviewModal");
    render(<ProfileReviewModal visible={true} parsedProfile={parsedProfile as any} onClose={() => {}} onSaved={() => {}} />);

    // Test-only debug output to help trace CI hangs where the reviewer overlay doesn't mount.
    // These logs are intentionally lightweight and will be removed after debugging.
    // eslint-disable-next-line no-console
    console.log('[TEST DEBUG] After render - body snapshot:', document.body.innerHTML.slice(0, 2000));
    try {
      // eslint-disable-next-line no-console
      console.log('[TEST DEBUG] Buttons:', screen.getAllByRole('button').map((b) => b.textContent));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[TEST DEBUG] Buttons: none found');
    }
    try {
      // eslint-disable-next-line no-console
      console.log('[TEST DEBUG] Headings:', screen.getAllByRole('heading').map((h) => h.textContent));
    } catch (e) {
      // ignore
    }

    // Wait for the reviewer overlay to mount, then enable "Show raw sections"
    await screen.findByRole('heading', { name: /Review parsed CV/i });
    const showRawCheckbox = await screen.findByRole('checkbox', { name: /Show raw sections/i }) as HTMLInputElement;
    expect(showRawCheckbox).toBeTruthy();
    fireEvent.click(showRawCheckbox);

    // When showRawSections is enabled, rawSections should be shown as-is.
    const reviewerPanel = await screen.findByTestId("cv-reviewer-stub");
    expect(reviewerPanel).toBeTruthy();

    // Assert both the link-only section and the summary content are visible
    await waitFor(() => {
      expect(within(reviewerPanel).getByText(/linkedin\.com\/in\/test-user/i)).toBeTruthy();
      expect(within(reviewerPanel).getByText(/Skilled engineer and tester/i)).toBeTruthy();
    });

    // Toggle "Use mapper stripping" OFF — current implementation does not alter rawSections based on this flag.
    const useMapperCheckbox = await screen.findByRole("checkbox", { name: /Use mapper stripping/i }) as HTMLInputElement;
    expect(useMapperCheckbox).toBeTruthy();
    // Click to change its state (the component toggles local boolean)
    fireEvent.click(useMapperCheckbox);

    // The link-only section should still be present in the displayed reviewer sections (no change to raw rendering)
    await waitFor(() => {
      expect(within(reviewerPanel).getByText(/linkedin\.com\/in\/test-user/i)).toBeTruthy();
      expect(within(reviewerPanel).getByText(/Skilled engineer and tester/i)).toBeTruthy();
    });
  });
});