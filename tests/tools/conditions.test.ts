import { describe, it, expect } from "vitest";
import { getCondition } from "../../src/tools/reference.js";
import type { DdbClient } from "../../src/api/client.js";

const stub = {} as DdbClient;
async function text(p: Promise<{ content: Array<{ type: string; text?: string }> }>): Promise<string> {
  const r = await p;
  return r.content.map((c) => (c.type === "text" ? c.text ?? "" : "")).join("\n");
}

describe("getCondition edition selection", () => {
  it("returns the reworked 2024 Exhaustion for edition 2024", async () => {
    const out = await text(getCondition(stub, { conditionName: "exhaustion", edition: "2024" }));
    expect(out).toMatch(/D20 Test/i);
    expect(out).toMatch(/2 (times|×)|2x/i);   // −2 × level
    expect(out).not.toMatch(/Level 1: Disadvantage on ability checks/); // not the 2014 ladder
  });

  it("returns the 2014 Exhaustion ladder for edition 2014", async () => {
    const out = await text(getCondition(stub, { conditionName: "exhaustion", edition: "2014" }));
    expect(out).toMatch(/Level 1: Disadvantage on ability checks/);
    expect(out).toMatch(/Level 6: Death/);
  });

  it("defaults to 2014 when edition is omitted", async () => {
    const out = await text(getCondition(stub, { conditionName: "exhaustion" }));
    expect(out).toMatch(/Level 1: Disadvantage on ability checks/);
  });

  it("serves an unchanged condition (poisoned) under 2024", async () => {
    const out = await text(getCondition(stub, { conditionName: "poisoned", edition: "2024" }));
    expect(out).toMatch(/disadvantage on attack rolls/i);
  });

  it("resolves a partial name against the 2024 set", async () => {
    const out = await text(getCondition(stub, { conditionName: "exhaust", edition: "2024" }));
    expect(out).toMatch(/D20 Test/i);          // matched the 2024 Exhaustion, not 2014
    expect(out).not.toMatch(/Level 1: Disadvantage on ability checks/);
  });
});
