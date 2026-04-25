import {
  formatLiveReviewSummary,
  parseDogfoodArgs,
  runLiveMatchReviewDogfood,
} from "./liveMatchReviewDogfood";

function usage(): never {
  throw new Error(
    [
      "Usage: tsx scripts/evals/run-live-match-review-dogfood.ts [--limit 50] [--out /tmp/match-review-live.json] [--labeled /tmp/match-review-live-labeled.json] [--summary-only]",
      "",
      "Exports live match review records by default, then prints the manual labeling and summarization steps.",
      "With --summary-only, reads a labeled JSON file and prints KPI counts.",
    ].join("\n"),
  );
}

const args = process.argv.slice(2);
if (args.includes("--help")) {
  usage();
}

const options = parseDogfoodArgs(args);

if (options.summaryOnly) {
  if (!options.labeledPath) {
    usage();
  }

  const result = await runLiveMatchReviewDogfood([
    "--summary-only",
    "--labeled",
    options.labeledPath,
  ]);
  if (result.kind !== "summary") {
    usage();
  }

  const summary = formatLiveReviewSummary(result.summary);
  process.stdout.write(`${summary}\n`);
} else {
  const result = await runLiveMatchReviewDogfood(args);
  if (result.kind !== "export") {
    usage();
  }

  process.stdout.write(
    [
      `Exported ${result.recordCount} records to ${result.outPath}.`,
      `Label them in ${options.labeledPath ?? "/tmp/match-review-live-labeled.json"}.`,
      ...result.nextSteps.map((step) => `- ${step}`),
    ].join("\n"),
  );
  process.stdout.write("\n");
}
