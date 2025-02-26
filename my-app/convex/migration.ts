import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const migrations = new Migrations<DataModel>(components.migrations);

export const updateMetricsLabels = migrations.define({
  table: "metrics",
  migrateOne: async (_ctx, doc) => {
    if (!doc.labels) {
      return { labels: {} };
    }
    return {};
  },
});

export const run = migrations.runner();
