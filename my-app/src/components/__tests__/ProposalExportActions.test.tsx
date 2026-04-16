import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProposalExportActions } from "../ProposalExportActions";

describe("ProposalExportActions", () => {
  it("uses one compact export trigger and exposes ATS, styled, and DOCX in the menu", async () => {
    const user = userEvent.setup();
    const onExportPdf = vi.fn();
    const onExportDocx = vi.fn();

    render(
      <ProposalExportActions
        onExportPdf={onExportPdf}
        onExportDocx={onExportDocx}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Export proposal" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Export ATS PDF/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Export proposal" }));
    expect(
      screen.getByRole("menuitem", { name: /Export ATS PDF/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Export Styled PDF/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Export DOCX/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Export ATS PDF/i }));
    expect(onExportPdf).toHaveBeenCalledWith("ats");

    await user.click(screen.getByRole("button", { name: "Export proposal" }));
    await user.click(screen.getByRole("menuitem", { name: /Export Styled PDF/i }));
    expect(onExportPdf).toHaveBeenLastCalledWith("styled");

    await user.click(screen.getByRole("button", { name: "Export proposal" }));
    await user.click(screen.getByRole("menuitem", { name: /Export DOCX/i }));
    expect(onExportDocx).toHaveBeenCalledTimes(1);
  });
});
