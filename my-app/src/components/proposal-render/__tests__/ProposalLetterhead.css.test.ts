import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const proposalCss = readFileSync(
  resolve(process.cwd(), "src/styles/product-proposal.css"),
  "utf8",
);

describe("proposal letterhead CSS", () => {
  it("keeps the letterhead templates scoped with stable A4 document geometry", () => {
    [
      ".proposal-cover-letter--director",
      ".proposal-cover-letter--volk",
      ".proposal-cover-letter--film-foto",
    ].forEach((scope) => {
      expect(proposalCss).toContain(`${scope} .dasti-proposal-document__page`);
      expect(proposalCss).toContain(`${scope} .proposal-cover-letter__body`);
    });

    expect(proposalCss).toMatch(
      /\.proposal-cover-letter--director\s+\.dasti-proposal-document__page,[\s\S]*?\.proposal-cover-letter--film-foto\s+\.dasti-proposal-document__page\s*\{[\s\S]*width:\s*210mm;[\s\S]*min-height:\s*297mm;[\s\S]*height:\s*297mm;/,
    );
    expect(proposalCss).not.toContain("director-letterhead html");
    expect(proposalCss).not.toContain("body.proposal-cover-letter--director");
  });
});
