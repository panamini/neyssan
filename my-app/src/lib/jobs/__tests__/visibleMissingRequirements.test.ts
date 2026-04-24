import { describe, expect, it } from "vitest";

import { selectVisibleMissingRequirements } from "../visibleMissingRequirements";

describe("selectVisibleMissingRequirements", () => {
  it("excludes metadata junk such as location, compensation, company, status, and part-time", () => {
    expect(
      selectVisibleMissingRequirements({
        missing: [
          "Paris",
          "Compensation",
          "Acme Inc.",
          "Status",
          "part-time",
        ],
        jobCompany: "Acme Inc.",
        jobLocation: "Paris",
      }),
    ).toEqual([]);
  });

  it("excludes benefits and boilerplate sentence fragments", () => {
    expect(
      selectVisibleMissingRequirements({
        missing: [
          "Benefits include medical, dental, and vision coverage.",
          "Equal opportunity employer",
        ],
      }),
    ).toEqual([]);
  });

  it("excludes stopwords and filler terms", () => {
    expect(
      selectVisibleMissingRequirements({
        missing: ["the", "and", "job"],
      }),
    ).toEqual([]);
  });

  it("keeps meaningful requirement terms", () => {
    expect(
      selectVisibleMissingRequirements({
        missing: [
          "de-escalation",
          "Customer-facing experience",
          "store management",
          "store operations",
          "retail store experience",
        ],
      }),
    ).toEqual([
      "de-escalation",
      "Customer-facing experience",
      "store management",
      "store operations",
      "retail store experience",
    ]);
  });

  it("suppresses Kith scrape location fragments without hiding actionable store phrases", () => {
    expect(
      selectVisibleMissingRequirements({
        missing: [
          "location",
          "miami",
          "design",
          "district",
          "store",
          "status",
          "part-time",
          "compensation",
        ],
        visibleRequirements: [
          "security guard license",
          "crowd management",
          "de-escalation",
          "customer-facing retail experience",
        ],
        jobTitle: "Security Guard",
        jobCompany: "Kith restaurants in Paris",
        jobLocation: "Miami, FL · 1 month ago · 19 people clicked apply",
      }),
    ).toEqual([]);

    expect(
      selectVisibleMissingRequirements({
        missing: ["store management", "store operations", "retail store experience"],
        jobTitle: "Security Guard",
        jobLocation: "Miami, FL",
      }),
    ).toEqual(["store management", "store operations", "retail store experience"]);
  });

  it("returns an empty list when only junk survives cleanup", () => {
    expect(
      selectVisibleMissingRequirements({
        missing: ["the", "Compensation", "Posted 3 days ago"],
      }),
    ).toEqual([]);
  });

  it("preserves French text without translating it", () => {
    expect(
      selectVisibleMissingRequirements({
        missing: ["Expérience client"],
        visibleRequirements: ["Expérience client"],
        jobCompany: "Exemple SAS",
        jobLocation: "Paris",
      }),
    ).toEqual(["Expérience client"]);
  });
});
