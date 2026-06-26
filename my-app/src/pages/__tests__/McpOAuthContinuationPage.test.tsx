import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { McpOAuthContinuationPage } from "../McpOAuthContinuationPage";

describe("McpOAuthContinuationPage", () => {
  it("keeps the continuation handle out of rendered text", () => {
    render(
      <MemoryRouter initialEntries={["/mcp/oauth/authorize/continue?mcp_oauth_intent=secret_handle-123"]}>
        <McpOAuthContinuationPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("main")).toHaveAttribute("data-mcp-oauth-intent-present", "true");
    expect(screen.queryByText("secret_handle-123")).not.toBeInTheDocument();
  });
});
