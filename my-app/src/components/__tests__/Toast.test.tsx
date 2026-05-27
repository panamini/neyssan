import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ToastProvider, toast } from "../ui/toast";

function ToastHarness() {
  return <div data-testid="toast-harness" />;
}

describe("Toast", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("localizes dismiss chrome from UI language only", async () => {
    window.localStorage.setItem("twoweeks:document-language", "ar");

    const { unmount } = render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    await act(async () => {
      toast.show({ title: "Hello" });
    });
    expect(await screen.findByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");
    unmount();

    window.localStorage.setItem("twoweeks:ui-language", "fr");
    const frRender = render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    await act(async () => {
      toast.show({ title: "Bonjour" });
    });
    expect(await screen.findByRole("button", { name: "Fermer" })).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");
    frRender.unmount();

    window.localStorage.setItem("twoweeks:ui-language", "es");
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    await act(async () => {
      toast.show({ title: "Hola" });
    });
    expect(await screen.findByRole("button", { name: "Descartar" })).toBeInTheDocument();
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");
  });

  it("still dismisses toasts when clicked", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    await act(async () => {
      toast.show({ title: "Hello" });
    });
    await user.click(await screen.findByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByText("Hello")).toBeNull();
    });
  });
});
