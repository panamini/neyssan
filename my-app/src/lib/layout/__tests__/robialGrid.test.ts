import { describe, expect, it } from "vitest";

import { ROBIAL_EXPORT_GRID } from "../robialGrid";

describe("ROBIAL_EXPORT_GRID", () => {
  it("uses the canonical export margins and columns", () => {
    expect(ROBIAL_EXPORT_GRID.page.margins).toEqual({
      top: "17mm",
      right: "35mm",
      bottom: "35mm",
      left: "17mm",
    });
    expect(ROBIAL_EXPORT_GRID.page.columns).toEqual({
      sidebar: "35mm",
      gutter: "18mm",
      main: "105mm",
    });
  });

  it("exposes cumulative 17/18 modular positions for both axes", () => {
    expect(ROBIAL_EXPORT_GRID.positions.inline).toEqual([
      "17mm",
      "35mm",
      "52mm",
      "70mm",
      "87mm",
      "105mm",
      "122mm",
      "140mm",
      "157mm",
      "175mm",
      "192mm",
    ]);
    expect(ROBIAL_EXPORT_GRID.positions.block).toEqual([
      "17mm",
      "35mm",
      "52mm",
      "70mm",
      "87mm",
      "105mm",
      "122mm",
      "140mm",
      "157mm",
      "175mm",
      "192mm",
      "210mm",
      "227mm",
      "245mm",
      "262mm",
      "280mm",
    ]);
  });
});
