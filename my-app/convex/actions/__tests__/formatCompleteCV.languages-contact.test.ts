import { describe, it } from "vitest";

// Temporarily disabled end-to-end verification test.
// This file previously contained a one-off integration test that modified the
// hybridParser mock and added debug logging. That verification is complete and
// the temporary test has been disabled to avoid interfering with the regular
// test run. If you need to re-enable a similar test, recreate it as a proper
// integration test that uses dependency injection or mocking instead of
// editing parser implementation files.
describe.skip("TEMP - disabled end-to-end verification", () => {
 it("disabled", () => {});
});