// my-app/convex/lib/parsing/__tests__/cvMapper.test.ts
import { describe, it, expect } from "vitest";
import { mapSectionsToCV } from "../cvMapper";

describe("mapSectionsToCV", () => {
  it("maps parsed sections + metadata into a canonical CV object", () => {
    const sections = [
      {
        title: "Professional Summary",
        content: "Seasoned full-stack engineer with 8 years experience building SaaS products.",
        fieldKey: "summary",
        confidence: 0.92,
      },
      {
        title: "Work Experience",
        content: "Acme Corp — Senior Engineer (2020-2024)\n- Led a team of 5\n- Improved performance by 30%",
        fieldKey: "experience",
        confidence: 0.9,
      },
      {
        title: "Previous Work",
        content: "Beta LLC — Engineer (2017-2020)\n- Built analytics pipeline",
        fieldKey: "experience",
        confidence: 0.85,
      },
      {
        title: "Education",
        content: "B.Sc. Computer Science — University X (2013-2017)",
        fieldKey: "education",
        confidence: 0.8,
      },
      {
        title: "Skills",
        content: "TypeScript, React, Node.js, Postgres",
        fieldKey: "skills",
        confidence: 0.88,
      },
      {
        title: "Contact",
        content: "Email: jane.doe@example.com\nLinkedIn: https://linkedin.com/in/janedoe",
        fieldKey: "contact",
        confidence: 0.7,
      },
    ] as any;

    const metadata = {
      name: "Jane Doe",
      email: "jane.doe@example.com",
    };

    const cv = mapSectionsToCV(sections, metadata);

    expect(cv.name).toBe("Jane Doe");
    expect(cv.contact?.email).toBe("jane.doe@example.com");
    expect(cv.summary).not.toBeNull();
    expect(cv.summary?.text).toContain("Seasoned full-stack engineer");
    expect(cv.experience.length).toBe(2);
    expect(cv.education.length).toBe(1);
    expect(cv.skills?.text).toContain("TypeScript");
    // contact fallback should include linkedin if present
    expect(cv.contact?.linkedinUrl).toBe("https://linkedin.com/in/janedoe");
  });
});