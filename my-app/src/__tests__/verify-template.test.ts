import { it } from "vitest";
import { generateCvTemplate } from "../lib/cv-template";
import { normalizeAndValidateCvDocument } from "../lib/normalize-cv";
import { parseCvDocumentStrict } from "../schemas/cvDocument.schema";

/**
 * This test prints the generated template and a normalized sample CV for manual inspection.
 * It also validates both outputs against the strict Zod schema.
 *
 * It's intended to be run locally in CI or dev to inspect JSON outputs.
 */
it("verify generateCvTemplate() and normalizeAndValidateCvDocument() outputs (logs)", () => {
  const cv = generateCvTemplate("Test CV");
  console.log("=== Generated CV template ===");
  console.log(JSON.stringify(cv, null, 2));

  try {
    parseCvDocumentStrict(cv);
    console.log("Schema validation (template): PASS");
  } catch (e) {
    console.error("Schema validation (template): FAIL", e);
    throw e;
  }

  const sampleCvText = `
John Doe
Email: john@example.com
Experience:
Software Engineer at ACME Corp (2020-2022)
- Developed features
- Achievements: improved performance by 30%
Education:
BSc Computer Science, University X (2016-2020)
  `;

  const res = normalizeAndValidateCvDocument(sampleCvText);
  console.log("=== Normalizer result ===");
  console.log(JSON.stringify(res, null, 2));

  if (res.success) {
    try {
      parseCvDocumentStrict(res.document);
      console.log("Schema validation (normalized): PASS");
    } catch (e) {
      console.error("Schema validation (normalized): FAIL", e);
      throw e;
    }
  } else {
    console.warn("Normalizer returned errors:", res.errors);
  }
});