/* eslint-disable @typescript-eslint/no-explicit-any -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import migrations from "@convex-dev/migrations/convex.config";

interface ConvexApp {
  use: (middleware: any) => void;
}

const app: ConvexApp = defineApp() as unknown as ConvexApp;
app.use(rateLimiter);
app.use(migrations);

export default app;
