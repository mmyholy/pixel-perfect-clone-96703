import { describe, it, expect } from "vitest";
import { allocate, earlyPenalty, interestRateFor } from "./saveflow";

describe("saveflow rules", () => {
  it("₦100,000 with 30% and 10% goals leaves ₦60,000", () => {
    const r = allocate(100000, [{ name: "a", percentage: 30 }, { name: "b", percentage: 10 }]);
    expect(r.parts.map((p) => p.amount)).toEqual([30000, 10000]);
    expect(r.remaining).toBe(60000);
  });
  it("early withdrawal penalty is 7%", () => {
    expect(earlyPenalty(100000)).toBe(7000);
  });
  it("longer locks earn more interest", () => {
    expect(interestRateFor("NGN", 1)).toBe(12);
    expect(interestRateFor("NGN", 12)).toBe(17);
  });
});
