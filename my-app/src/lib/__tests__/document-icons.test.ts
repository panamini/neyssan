import { describe, expect, it } from "vitest";

import {
  DOCUMENT_ICON_CATEGORIES,
  DEFAULT_DOCUMENT_ICON_KEY,
  TW_DOCUMENT_ICONS,
  getDocumentIcon,
  normalizeDocumentIconSettings,
  renderDocumentIconHtml,
  resolveDefaultListMarkerIconKey,
  resolveSectionHeadingIconKey,
} from "../document-icons";

describe("document-icons", () => {
  it("exposes the curated document icon categories", () => {
    expect(DOCUMENT_ICON_CATEGORIES.map((category) => category.id)).toEqual([
      "core",
      "work",
      "skills",
      "tech",
      "security",
      "communication",
      "languages",
      "analytics",
      "design",
      "legal-admin",
      "people",
      "movement",
      "sports",
      "interests",
    ]);
    expect(TW_DOCUMENT_ICONS.length).toBeGreaterThanOrEqual(80);
    expect(getDocumentIcon("soccer-ball")?.category).toBe("sports");
    expect(getDocumentIcon("music-note")?.category).toBe("interests");
    expect(getDocumentIcon("plane")?.tags).toContain("travel");
  });

  it("falls back safely when an icon key is missing", () => {
    expect(getDocumentIcon("missing")).toBeNull();
    expect(
      resolveDefaultListMarkerIconKey({
        defaultListMarkerKey: "missing",
        sectionHeadingIconMode: "none",
        sectionIconMap: {},
        color: "accent",
        sizePt: 10,
      }),
    ).toBe(DEFAULT_DOCUMENT_ICON_KEY);
  });

  it("defaults section heading icons off", () => {
    const settings = normalizeDocumentIconSettings(null);

    expect(settings.sectionHeadingIconMode).toBe("none");
    expect(settings.sizePt).toBe(8);
    expect(
      resolveSectionHeadingIconKey({
        settings,
        sectionType: "experience",
        sectionTitle: "Experience",
      }),
    ).toBeNull();
  });

  it("resolves automatic section heading icons with loose categories", () => {
    const settings = normalizeDocumentIconSettings({
      sectionHeadingIconMode: "auto",
      color: "muted",
      sizePt: 10,
    });

    expect(
      resolveSectionHeadingIconKey({
        settings,
        sectionType: "skills",
        sectionTitle: "Skills",
      }),
    ).toBe("wrench");
    expect(
      resolveSectionHeadingIconKey({
        settings,
        sectionType: "certifications",
        sectionTitle: "Certifications",
      }),
    ).toBe("certificate");
  });

  it("renders inline svg html without external assets", () => {
    const html = renderDocumentIconHtml({
      iconKey: "briefcase",
      color: "accent",
      sizePt: 9,
    });

    expect(html).toContain("<svg");
    expect(html).toContain("currentColor");
    expect(html).toContain("width:9pt");
    expect(html).not.toMatch(/(?:src|href|xlink:href)=["']https?:/i);
  });

  it("allows default list markers from the curated document icon library", () => {
    expect(
      resolveDefaultListMarkerIconKey({
        defaultListMarkerKey: "asterisk-simple",
        sectionHeadingIconMode: "none",
        sectionIconMap: {},
        color: "accent",
        sizePt: 10,
      }),
    ).toBe("asterisk-simple");

    expect(
      resolveDefaultListMarkerIconKey({
        defaultListMarkerKey: "briefcase",
        sectionHeadingIconMode: "none",
        sectionIconMap: {},
        color: "accent",
        sizePt: 10,
      }),
    ).toBe("briefcase");
  });

  it("infers icon list marker mode for legacy icon-only settings", () => {
    expect(
      normalizeDocumentIconSettings({
        defaultListMarkerKey: "diamond",
        sectionHeadingIconMode: "none",
        sectionIconMap: {},
        color: "accent",
        sizePt: 10,
      }),
    ).toEqual(
      expect.objectContaining({
        listMarkerType: "icon",
        defaultListMarkerKey: "diamond",
      }),
    );
  });
});
