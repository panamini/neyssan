import fs from "fs";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: "./my-app/.env" });

async function main() {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error("MISTRAL_API_KEY not set in my-app/.env");
    process.exit(2);
  }

  const model = process.env.MISTRAL_MODEL ?? "mistral-small-latest";
  const rawText = `
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

  const system = "You are an expert CV parsing engine. Return structured JSON if possible, but do not include provider metadata in the output. Prefer a single top-level JSON object.";
  const user = `Parse this CV and return either a JSON object matching the schema or a human-readable attempt:\n\n${rawText}`;

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.0,
    max_tokens: 2000
  };

  try {
    console.log("Sending request to Mistral model:", model);
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const txt = await res.text();
    try {
      const j = JSON.parse(txt);
      fs.writeFileSync("tmp-mistral-full-response.json", JSON.stringify(j, null, 2), "utf-8");
      console.log("Wrote tmp-mistral-full-response.json (size:", Buffer.byteLength(JSON.stringify(j)), "bytes )");
      // Print a short preview of top-level keys and first choice content if present
      const keys = Object.keys(j);
      console.log("Top-level keys:", keys.join(", "));
      if (j.choices && j.choices[0]) {
        console.log("choices[0] preview:", JSON.stringify(j.choices[0], null, 2).slice(0, 1000));
      } else if (j.output) {
        console.log("output preview:", JSON.stringify(j.output, null, 2).slice(0, 1000));
      } else {
        console.log("Raw response preview:", String(txt).slice(0, 1000));
      }
    } catch (e) {
      // Not JSON
      fs.writeFileSync("tmp-mistral-full-response.txt", txt, "utf-8");
      console.log("Wrote tmp-mistral-full-response.txt (non-JSON response). Preview:");
      console.log(txt.slice(0, 2000));
    }
  } catch (err) {
    console.error("Mistral request failed:", String(err));
    process.exit(1);
  }
}

main();