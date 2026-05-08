import { describe, expect, it } from "vitest";
import {
  DOCUMENT_STYLE_SLOT_IDS,
  FACTORY_DOCUMENT_STYLE_SLOTS,
  PROPOSAL_BUNDLE_BY_DOCUMENT_STYLE_SLOT,
  getFactoryDocumentStyleSlot,
  getProposalBundleForDocumentStyleSlot,
  resolveDocumentStyleSlotId,
} from "../document-style-slots";

describe("document-style-slots", () => {
  it("defines the locked Style 1/2/3 factory contract", () => {
    expect(DOCUMENT_STYLE_SLOT_IDS).toEqual([1, 2, 3]);
    expect(FACTORY_DOCUMENT_STYLE_SLOTS.map((slot) => slot.id)).toEqual([
      1, 2, 3,
    ]);
    expect(getFactoryDocumentStyleSlot(2).appearance).toMatchObject({
      layout: "workshop",
      typography: "quiet-editorial",
      palette: "ink",
    });
    expect(getFactoryDocumentStyleSlot(2).defaultCvTemplateId).toBe(
      "workshop_resume_twocol_ats",
    );
  });

  it("keeps proposal compatibility mapping deterministic", () => {
    expect(PROPOSAL_BUNDLE_BY_DOCUMENT_STYLE_SLOT).toEqual({
      1: "swiss_serif",
      2: "magazine_editorial",
      3: "grid_mono",
    });
    expect(getProposalBundleForDocumentStyleSlot(2)).toBe("magazine_editorial");
    expect(getProposalBundleForDocumentStyleSlot("2")).toBeNull();
  });

  it("accepts only persisted slot ids", () => {
    expect(resolveDocumentStyleSlotId(1)).toBe(1);
    expect(resolveDocumentStyleSlotId(4)).toBeNull();
    expect(resolveDocumentStyleSlotId("1")).toBeNull();
  });
});
