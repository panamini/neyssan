import { describe, expect, it } from "vitest";
import { getScrollEdgeState } from "../use-scroll-edge-fades";

describe("useScrollEdgeFades", () => {
  it("returns progressive edge strengths instead of boolean-only thresholds", () => {
    const state = getScrollEdgeState({
      scrollHeight: 500,
      clientHeight: 200,
      scrollTop: 14,
    });

    expect(state.showTop).toBe(true);
    expect(state.showBottom).toBe(true);
    expect(state.topStrength).toBeCloseTo(0.5, 3);
    expect(state.bottomStrength).toBe(1);
  });

  it("clears edge strengths when the node cannot scroll", () => {
    const state = getScrollEdgeState({
      scrollHeight: 200,
      clientHeight: 200,
      scrollTop: 0,
    });

    expect(state).toEqual({
      showTop: false,
      showBottom: false,
      topStrength: 0,
      bottomStrength: 0,
    });
  });
});
