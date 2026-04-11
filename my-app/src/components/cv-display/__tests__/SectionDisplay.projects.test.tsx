import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { SectionDisplay } from "../SectionDisplay";
import type { CvSection } from "../../../types/cvDocument";

vi.mock("../../../contexts/CvLibraryContext", () => ({
  useCvLibrary: () => ({
    currentCv: null,
    importCv: vi.fn(),
  }),
}));

vi.mock("../../cv-editor/BlockRenderer", () => ({
  __esModule: true,
  default: () => <div data-testid="block-renderer">raw block fallback</div>,
}));

vi.mock("../../StrictExtractButton", () => ({
  StrictExtractButton: () => null,
}));

describe("SectionDisplay projects rendering", () => {
  it("prefers structured project cards over raw project blocks", () => {
    const section: CvSection = {
      id: "sec-projects",
      title: "Projects",
      type: "projects",
      collapsed: false,
      blocks: [
        {
          id: "project-block-1",
          title: "Projects",
          type: "text",
          plainText:
            "Gitlytics | Python, Flask, React, PostgreSQL, Docker | June 2020 – Present Developed a full-stack web application",
        },
      ],
      structuredContent: [
        {
          id: "project-1",
          title: "Gitlytics",
          meta: "Python, Flask, React, PostgreSQL, Docker | June 2020 – Present",
          description: "Developed a full-stack web application using Flask serving a REST API with React as the frontend.",
        },
      ],
    };

    render(<SectionDisplay section={section} />);

    expect(screen.getByRole("heading", { level: 2, name: "Projects" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Gitlytics" })).toBeInTheDocument();
    expect(
      screen.getByText("Python, Flask, React, PostgreSQL, Docker | June 2020 – Present"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Developed a full-stack web application using Flask/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("block-renderer")).toBeNull();
  });
});
