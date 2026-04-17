import { describe, expect, it } from "vitest";

import {
  getProposalExtensionSourceLinks,
  PROPOSAL_EXTENSION_INSTALL_LINK,
} from "../proposal-source-platforms";

describe("proposal source platforms", () => {
  it("uses the French ZipRecruiter helper link for French locales", () => {
    const links = getProposalExtensionSourceLinks("fr-FR");
    expect(
      links.find((link) => link.key === "ziprecruiter")?.href,
    ).toBe("https://www.ziprecruiter.fr/");
  });

  it("uses the default ZipRecruiter helper link for non-French locales", () => {
    const links = getProposalExtensionSourceLinks("en-US");
    expect(
      links.find((link) => link.key === "ziprecruiter")?.href,
    ).toBe("https://www.ziprecruiter.com");
  });

  it("keeps the install CTA centralized", () => {
    expect(PROPOSAL_EXTENSION_INSTALL_LINK.label).toBe(
      "Install Chrome extension",
    );
    expect(PROPOSAL_EXTENSION_INSTALL_LINK.href).toBe(
      "https://chromewebstore.google.com/",
    );
  });
});
