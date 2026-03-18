import fs from "node:fs";
import path from "node:path";
import { getCollapsedLine } from "../src/utils/getCollapsedLine";
import { engineHintFromDiagnostics } from "../src/utils/cv/mapping-utils";

function run(p: string) {
  const raw = fs.readFileSync(p, "utf8");
  const j = JSON.parse(raw);
  const entry = (j as any)?.normalized ?? j;
  const diag = (j as any)?.diagnostics ?? {};
  const line = getCollapsedLine(entry, diag);
  const badge = engineHintFromDiagnostics(diag);
  console.log(JSON.stringify({ file: path.basename(p), preview: line, badge }, null, 2));
}

const args = process.argv.slice(2).filter(Boolean);
for (const a of args) {
  if (fs.existsSync(a)) run(a);
}
