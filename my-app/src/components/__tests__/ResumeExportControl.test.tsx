import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ResumeExportControl } from "../ResumeExportControl";

describe("ResumeExportControl", () => {
  it("renders explicit ATS and styled PDF actions plus overflow formats", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(
      <ResumeExportControl
        exportingFormat={null}
        onExport={onExport}
        statusDescription="Trusted Mistral v3"
        statusLabel="ATS Ready"
        statusTone="trusted"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Export ATS PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More export formats" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ATS Ready")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export ATS PDF" }));
    expect(onExport).toHaveBeenCalledWith({
      format: "pdf",
      mode: "ats",
    });

    await user.click(screen.getByRole("button", { name: "Export Styled PDF" }));
    expect(onExport).toHaveBeenCalledWith({
      format: "pdf",
      mode: "styled",
    });

    await user.click(screen.getByRole("button", { name: "More export formats" }));

    expect(
      screen.getByRole("menuitem", { name: /Export DOCX/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Export Markdown/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Export JSON/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Trusted Mistral v3").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("menuitem", { name: /Export JSON/i }));
    expect(onExport).toHaveBeenCalledWith({
      format: "json",
    });
  });

  it("disables styled PDF when the active baseline layout is not available", () => {
    const onExport = vi.fn();

    render(
      <ResumeExportControl
        exportingFormat={null}
        onExport={onExport}
        statusDescription="Trusted Mistral v3"
        statusLabel="ATS Ready"
        styledPdfDisabled
        styledPdfDisabledReason="Styled PDF is unavailable for the current resume layout."
      />,
    );

    expect(
      screen.getByRole("button", { name: "Export ATS PDF" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Export Styled PDF" }),
    ).toHaveAttribute(
      "title",
      "Styled PDF is unavailable for the current resume layout.",
    );
  });
});
