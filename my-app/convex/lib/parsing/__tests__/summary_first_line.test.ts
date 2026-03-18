import { firstSentence } from "../canonicalize";

describe("firstSentence", () => {
  it("strips contact debris and returns the first clean sentence", () => {
    const input = "LinkedIn: example | github.com/foo\n, Passionate engineer building resilient systems. Lover of commas.";
    const result = firstSentence(input);
    expect(result).toBe("Passionate engineer building resilient systems.");
  });

  it("falls back to cleaned text when no punctuation is present", () => {
    const input = "email@example.com | +44 0000 000000\nCommitted product manager";
    const result = firstSentence(input);
    expect(result).toBe("Committed product manager");
  });

  it("returns the full leading sentence for multi-line summaries", () => {
    const input = [
      "Safety conscious, attentive Security Guard with eight years experience in protecting and",
      "guarding VIP individuals in the military and defense sectors. Proficient at observing",
      "surroundings and immediate settings for possible threats of nonhuman and human nature."
    ].join("\n");
    const result = firstSentence(input);
    expect(result).toBe(
      "Safety conscious, attentive Security Guard with eight years experience in protecting and guarding VIP individuals in the military and defense sectors."
    );
  });
});
