import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TemplatesPage } from "../TemplatesPage";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe("TemplatesPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it("renders cover-letter templates with skeleton labels by default", () => {
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Templates" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cover letters" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByText("Minimal")).toBeInTheDocument();
    expect(screen.getByText("Bold")).toBeInTheDocument();
    expect(screen.queryByText("Editorial")).toBeNull();
    expect(screen.queryByRole("tab", { name: "CVs" })).toBeNull();
  });

  it("filters to resume templates and links style customization to settings", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <TemplatesPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: "Resume" }));
    expect(screen.getByText("Two-column")).toBeInTheDocument();
    expect(screen.getByText("Classic")).toBeInTheDocument();
    expect(screen.queryByText("Letterpress")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Customize style" }));
    expect(navigateMock).toHaveBeenCalledWith("/settings?tab=docstyle");
  });
});
