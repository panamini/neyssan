import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { translateUi } from "../i18n";
import { useUiLanguagePreference } from "../ui-preferences";

function LanguageController(): JSX.Element {
  const { setLanguage } = useUiLanguagePreference();
  return (
    <>
      <button type="button" onClick={() => setLanguage("fr")}>
        French
      </button>
      <button type="button" onClick={() => setLanguage("es")}>
        Spanish
      </button>
    </>
  );
}

function LanguageChromeProbe(): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  return (
    <div aria-label="translated nav label">
      {translateUi(resolvedLanguage, "nav.proposal")}
    </div>
  );
}

describe("UI language preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("updates other hook consumers in the same tab without a page refresh", () => {
    window.localStorage.setItem("twoweeks:document-language", "ar");

    render(
      <>
        <LanguageController />
        <LanguageChromeProbe />
      </>,
    );

    expect(screen.getByLabelText("translated nav label")).toHaveTextContent(
      "Letter",
    );

    fireEvent.click(screen.getByRole("button", { name: "French" }));
    expect(screen.getByLabelText("translated nav label")).toHaveTextContent(
      "Lettre",
    );
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");

    fireEvent.click(screen.getByRole("button", { name: "Spanish" }));
    expect(screen.getByLabelText("translated nav label")).toHaveTextContent(
      "Carta",
    );
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe("ar");
  });
});
