import { render, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import StrictUploadButton from "../components/StrictUploadButton";

const withSpansMock = vi.fn();
const toastMock = vi.fn();

vi.mock("../../convex/_generated/api", () => ({
  api: {
    actions: {
      extractProfileStrictWithSpans: "withSpans",
    },
  },
}))

vi.mock("convex/react", () => ({
  useAction: (ref: unknown) => {
    if (ref === "withSpans") return withSpansMock;
    return undefined;
  },
}))

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue("token") }),
}))

vi.mock("../components/ui/toast", () => ({
  useToast: () => ({ showToast: toastMock }),
}))

vi.mock("../services/pdf/browser-cv-parser", () => ({
  parsePdfArrayBuffer: vi.fn(),
}))

describe("StrictUploadButton", () => {
  beforeEach(() => {
    withSpansMock.mockReset();
    toastMock.mockReset();
    Object.defineProperty(File.prototype, "text", {
      configurable: true,
      value: vi.fn().mockResolvedValue("Sample"),
    });
  });

  it("calls strict action and overlays sections", async () => {
    withSpansMock.mockResolvedValue({
      profile: {
        email: "strict@example.com",
      },
    });

    const onApply = vi.fn();
    const sections = [
      {
        id: "profile",
        type: "profile",
        title: "Profile",
        blocks: [],
        collapsed: false,
        structuredContent: [{ id: "p1", name: null, email: null, phone: null, location: null }],
      },
    ];

    const { container } = render(
      <StrictUploadButton
        sections={sections as any}
        onApplyToSections={onApply}
        label="Strict Upload"
      />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["Sample"], "resume.txt", { type: "text/plain" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(withSpansMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalled();
  });
});
