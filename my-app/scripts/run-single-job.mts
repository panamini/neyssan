import { parseCV } from "../convex/lib/parsing/hybridParser";
import fs from "fs";

async function main() {
  // Force GPT-only path for this run to ensure OpenAI is used directly
  process.env.FORCE_GPT_ONLY = "1";

  const sampleFrenchCV = `
PROFIL
Ingénieur logiciel expérimenté avec 5 ans d'expérience dans le développement backend.

EXPÉRIENCE
2020 - 2024 — Acme Corp
- Ingénieur logiciel senior
- Développement de services Node.js et TypeScript

COMPÉTENCES
TypeScript, Node.js, PostgreSQL, Docker

COORDONNÉES
john.doe@example.com
+33 6 12 34 56 78
https://linkedin.com/in/johndoe
  `;

  console.log("Invoking parseCV on sample input (length:", sampleFrenchCV.length, ")");

  try {
    const result = await parseCV(sampleFrenchCV);
    console.log("parseCV result (pretty):");
    console.log(JSON.stringify(result, null, 2));
    // also write to /tmp for easy retrieval
    try {
      fs.writeFileSync("tmp-parse-result.json", JSON.stringify(result, null, 2), "utf-8");
      console.log("Wrote tmp-parse-result.json");
    } catch (e) {
      // ignore
    }
    process.exit(0);
  } catch (err: any) {
    console.error("Error running parseCV:", err?.message ?? String(err));
    process.exit(1);
  }
}

main();