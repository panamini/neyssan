import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  COVER_LETTER_TEMPLATES,
  getCoverLetterRouteTemplateIntent,
} from "../TemplatesPage";

describe("ProposalForge canonical template quick menu contract", () => {
  it("mirrors the full cover-letter gallery in the letter template panel", () => {
    expect(
      COVER_LETTER_TEMPLATES.map((template) => [
        template.name,
        getCoverLetterRouteTemplateIntent(template),
      ]),
    ).toEqual([
      ["Minimal · US Letter", "workshop_proposal_margin"],
      ["French · A4", "modernist_signal"],
      ["Editorial", "editorial_wide"],
      ["Twoweeks Letterhead", "twoweeks-letterhead"],
      ["Director Letterhead", "director-letterhead"],
      ["Volk Letterhead", "volk-letterhead"],
      ["Film und Foto Letterhead", "film-foto-letterhead"],
      ["MoMA Bauhaus Letterhead", "moma-bauhaus-letterhead"],
      ["Bayer", "bayer-letterhead"],
    ]);

    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/pages/ProposalForge.tsx"),
      "utf8",
    );
    const start = source.indexOf("const proposalTemplatePanelItems");
    const end = source.indexOf(
      "const proposalTemplatePanelRegistration",
      start,
    );
    const quickMenuSource = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(quickMenuSource).not.toContain("PROPOSAL_TEMPLATE_DEFINITIONS.map");
    expect(quickMenuSource).toContain("COVER_LETTER_TEMPLATES.flatMap");
    expect(quickMenuSource).toContain("getCoverLetterRouteTemplateIntent");
  });
});
