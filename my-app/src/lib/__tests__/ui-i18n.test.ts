import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EN_UI_MESSAGES,
  UI_MESSAGES,
  UI_MESSAGE_LOCALES,
  getUiMessage,
  normalizeUiMessageLocale,
  translateUi,
  type UiMessageKey,
} from "../i18n";

describe("UI i18n foundation", () => {
  it("resolves starter UI keys for English, French, and Spanish", () => {
    expect(getUiMessage("en", "common.save")).toBe("Save");
    expect(getUiMessage("fr", "common.save")).toBe("Enregistrer");
    expect(getUiMessage("es", "common.save")).toBe("Guardar");

    expect(translateUi("en", "nav.settings")).toBe("Settings");
    expect(translateUi("en", "nav.proposal")).toBe("Letter");
    expect(translateUi("fr", "nav.proposal")).toBe("Lettre");
    expect(translateUi("es", "nav.proposal")).toBe("Carta");
    expect(translateUi("fr", "settings.interfaceLanguage")).toBe(
      "Langue de l'interface",
    );
    expect(translateUi("es", "settings.defaultDocumentLanguage")).toBe(
      "Idioma predeterminado del documento",
    );
    expect(translateUi("fr", "settings.tabs.account.label")).toBe("Profil");
    expect(translateUi("es", "settings.tabs.theme.label")).toBe("Tema");
    expect(translateUi("fr", "settings.themeMode.light")).toBe("Clair");
    expect(translateUi("en", "topbar.searchOrRunCommand")).toBe("Search");
    expect(translateUi("fr", "topbar.searchOrRunCommand")).toBe("Rechercher");
    expect(translateUi("es", "topbar.searchOrRunCommand")).toBe("Buscar");
    expect(translateUi("fr", "workspace.draftProposal")).toBe(
      "Rédiger la lettre",
    );
    expect(translateUi("es", "workspace.draftProposal")).toBe(
      "Redactar carta",
    );
  });

  it("keeps FR/ES letter terminology out of proposition/propuesta wording", () => {
    const localizedMessages = [
      ...Object.values(UI_MESSAGES.fr),
      ...Object.values(UI_MESSAGES.es),
    ].join("\n");

    expect(localizedMessages).not.toMatch(
      /Proposition|Propositions|proposition|propositions|Propuesta|Propuestas|propuesta|propuestas/,
    );
  });

  it("exposes only production UI locales for UI dictionaries", () => {
    expect(UI_MESSAGE_LOCALES).toEqual(["en", "fr", "es"]);
  });

  it("falls back to English for unsupported or document-only locales", () => {
    expect(normalizeUiMessageLocale("de")).toBe("en");
    expect(normalizeUiMessageLocale("ar")).toBe("en");
    expect(normalizeUiMessageLocale("ru")).toBe("en");
    expect(normalizeUiMessageLocale("ga")).toBe("en");
    expect(normalizeUiMessageLocale("el")).toBe("en");

    expect(getUiMessage("ar", "settings.documentLanguageAutoHelp")).toBe(
      EN_UI_MESSAGES["settings.documentLanguageAutoHelp"],
    );
  });

  it("falls back to English and never returns blank for a missing key", () => {
    const missingKey = "missing.key" as UiMessageKey;

    expect(getUiMessage("fr", missingKey)).toBe("missing.key");
    expect(getUiMessage("es", missingKey)).not.toBe("");
  });

  it("keeps starter dictionaries complete against the English baseline", () => {
    const baselineKeys = Object.keys(EN_UI_MESSAGES).sort();

    for (const locale of UI_MESSAGE_LOCALES) {
      expect(Object.keys(UI_MESSAGES[locale]).sort()).toEqual(baselineKeys);
    }
  });

  it("does not read or write the document language preference", () => {
    window.localStorage.setItem("twoweeks:document-language", "ar");

    expect(getUiMessage("fr", "nav.today")).toBe("Aujourd'hui");
    expect(window.localStorage.getItem("twoweeks:document-language")).toBe(
      "ar",
    );
  });

  it("does not import document or export language modules", () => {
    const i18nSource = readFileSync(
      path.join(process.cwd(), "src/lib/i18n/ui-i18n.ts"),
      "utf8",
    );
    const messagesSource = readFileSync(
      path.join(process.cwd(), "src/lib/i18n/ui-messages.ts"),
      "utf8",
    );
    const combinedSource = `${i18nSource}\n${messagesSource}`;

    expect(combinedSource).not.toContain("document-language");
    expect(combinedSource).not.toContain("export-locale");
    expect(combinedSource).not.toContain("export-renderers");
    expect(combinedSource).not.toContain("document-export-models");
  });
});
