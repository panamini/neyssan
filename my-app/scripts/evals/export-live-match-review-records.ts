import { writeFileSync } from "node:fs";

import {
  exportLiveMatchReviewRecords,
  parseDogfoodArgs,
} from "./liveMatchReviewDogfood";

function usage(): never {
  throw new Error(
    [
      "Usage: tsx scripts/evals/export-live-match-review-records.ts [--limit 50] [--out review.json]",
      "",
      "Loads my-app/.env and my-app/.env.local automatically.",
      "Uses the local Convex backend state in ~/.convex/convex-backend-state when available, or a valid CONVEX_AUTH_TOKEN JWT if provided in the shell.",
    ].join("\n"),
  );
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  usage();
}

const options = parseDogfoodArgs(args);
const records = await exportLiveMatchReviewRecords({ limit: options.limit });
const output = `${JSON.stringify(records, null, 2)}\n`;

if (options.outPath) {
  writeFileSync(options.outPath, output);
} else {
  process.stdout.write(output);
}
