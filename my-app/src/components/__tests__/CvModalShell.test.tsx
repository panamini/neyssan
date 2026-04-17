import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CvModalShell } from "../structured-blocks/CvModalShell";

describe("CvModalShell", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("locks body scrolling while the modal is open and restores it after close", () => {
    const { rerender } = render(
      <CvModalShell open onClose={() => undefined}>
        <div>Modal body</div>
      </CvModalShell>,
    );

    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByText("Modal body")).toBeInTheDocument();

    rerender(
      <CvModalShell open={false} onClose={() => undefined}>
        <div>Modal body</div>
      </CvModalShell>,
    );

    expect(document.body.style.overflow).toBe("");
  });
});
