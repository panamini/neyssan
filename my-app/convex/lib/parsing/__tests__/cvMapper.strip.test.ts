import { test, expect } from "vitest";
import { mapSectionsToCV } from "../cvMapper";

test("strips link-only sections when stripLinkOnly=true and preserves rawSections", async () => {
  const sections = [
    {
      title: "Contact",
      content: "linkedin.com/in/test-user",
      fieldKey: "contact",
      confidence: 0.8,
    },
    {
      title: "Summary",
      content: "Experienced developer with a focus on testing.",
      fieldKey: "summary",
      confidence: 0.9,
    },
  ];

  const cv = await mapSectionsToCV(sections as any, undefined, { stripLinkOnly: true });

  // rawSections preserves original parsed sections
  expect(cv.rawSections).toBeDefined();
  expect(Array.isArray(cv.rawSections)).toBe(true);
  expect(cv.rawSections!.length).toBe(2);

  // Even when stripping, extract link-only URLs into metadata/contact
  expect(cv.contact).toBeDefined();
  expect(cv.contact?.linkedinUrl).toBe("https://linkedin.com/in/test-user");

  // Summary should still be present
  expect(cv.summary).toBeDefined();
  expect(cv.summary?.text).toContain("Experienced developer");
});

test("keeps link-only sections when stripLinkOnly=false and extracts linkedin", async () => {
  const sections = [
    {
      title: "Contact",
      content: "https://linkedin.com/in/test-user",
      fieldKey: "contact",
      confidence: 0.8,
    },
    {
      title: "Summary",
      content: "Experienced developer with a focus on testing.",
      fieldKey: "summary",
      confidence: 0.9,
    },
  ];

  const cv = await mapSectionsToCV(sections as any, undefined, { stripLinkOnly: false });

  // rawSections preserved
  expect(cv.rawSections).toBeDefined();
  expect(cv.rawSections!.length).toBe(2);

  // When stripping disabled, the mapper should extract and normalize the linkedin URL
  expect(cv.contact).toBeDefined();
  expect(cv.contact?.linkedinUrl).toBe("https://linkedin.com/in/test-user");

  // Summary remains present
  expect(cv.summary).toBeDefined();
  expect(cv.summary?.text).toContain("Experienced developer");
});
