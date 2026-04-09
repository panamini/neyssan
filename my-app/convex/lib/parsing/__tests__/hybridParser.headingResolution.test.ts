import { describe, expect, it } from "vitest";

import { determineHeuristicFieldKey } from "../hybridParser";

describe("hybridParser heading resolution", () => {
  it("resolves multi-word headings to canonical field keys", () => {
    expect(determineHeuristicFieldKey("Professional Experience")).toBe("experience");
    expect(determineHeuristicFieldKey("Professional Summary")).toBe("summary");
    expect(determineHeuristicFieldKey("Education & Training")).toBe("education");
    expect(determineHeuristicFieldKey("Technical Skills")).toBe("skills");
    expect(determineHeuristicFieldKey("Languages & Proficiency")).toBe("languages");
    expect(determineHeuristicFieldKey("Certifications")).toBe("certifications");
    expect(determineHeuristicFieldKey("Projects")).toBe("projects");
    expect(determineHeuristicFieldKey("Affiliations")).toBe("affiliations");
    expect(determineHeuristicFieldKey("Hobbies")).toBe("hobbies");
    expect(determineHeuristicFieldKey("Additional Information")).toBe("additional_information");
  });
});
