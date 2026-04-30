import { describe, expect, it } from "vitest";

import {
  buildLanguageSuggestionShortlist,
  filterHobbySuggestionItems,
  filterLanguageSuggestionItems,
} from "../cvAiSuggestions";

describe("CV AI suggestions", () => {
  it("does not treat Java programming evidence as a spoken language", () => {
    expect(
      buildLanguageSuggestionShortlist({
        experiences: [
          {
            position: "Engineer",
            description: "Built services with Java and JavaScript.",
          },
        ],
      }),
    ).not.toContain("Java");
  });

  it("filters language model output to canonical human language names", () => {
    expect(filterLanguageSuggestionItems(["English", "Java", "Javanese"])).toEqual([
      "English",
      "Javanese",
    ]);
  });

  it("filters professional skill-like hobby suggestions", () => {
    expect(
      filterHobbySuggestionItems({
        items: ["Photography", "REST API Development", "Git", "French"],
        blockedItems: ["Git"],
      }),
    ).toEqual(["Photography"]);
  });
});
