import { describe, expect, it } from "vitest";
import { applyChoices, computeChanges, pairBullets } from "@/features/results/changes";
import type { ResumeDoc } from "@/lib/api/types";

const base: ResumeDoc = {
  contact: { name: "Asha", headline: null, email: null, phone: null, location: null, links: [] },
  summary: "Engineer who builds web apps.",
  skills: [{ name: "Languages", items: ["Python", "Go"] }],
  experience: [
    {
      id: "exp-1",
      role: "Engineer",
      company: "Acme",
      location: null,
      start: null,
      end: null,
      bullets: ["Built a billing API in Python", "Mentored two interns"],
    },
  ],
  projects: [],
  education: [],
  extras: [],
};

const tailored: ResumeDoc = {
  ...structuredClone(base),
  summary: "Backend engineer who builds reliable Python APIs.",
  experience: [
    {
      ...base.experience[0],
      bullets: ["Mentored two interns", "Built a billing REST API in Python"],
    },
  ],
};

describe("pairBullets", () => {
  it("pairs reordered bullets with their sources one-to-one", () => {
    expect(pairBullets(base.experience[0].bullets, tailored.experience[0].bullets)).toEqual([1, 0]);
  });

  it("never pairs two bullets to the same source", () => {
    const pairs = pairBullets(["a b c", "x y z"], ["a b c", "a b c"]);
    expect(new Set(pairs).size).toBe(2);
  });
});

describe("computeChanges", () => {
  it("reports summary edits and rewritten or moved bullets", () => {
    const changes = computeChanges(base, tailored);
    expect(changes.map((c) => c.key)).toEqual(["summary", "exp-1:0", "exp-1:1"]);
    expect(changes.find((c) => c.key === "exp-1:0")?.moved).toEqual({ from: 1, to: 0 });
  });

  it("finds nothing when nothing changed", () => {
    expect(computeChanges(base, structuredClone(base))).toEqual([]);
  });
});

describe("applyChoices", () => {
  it("returns the tailored resume when nothing is rejected", () => {
    expect(applyChoices(base, tailored, [])).toBe(tailored);
  });

  it("restores the original wording of rejected changes only", () => {
    const result = applyChoices(base, tailored, ["summary", "exp-1:1"]);
    expect(result.summary).toBe(base.summary);
    expect(result.experience[0].bullets).toEqual([
      "Mentored two interns",
      "Built a billing API in Python",
    ]);
    expect(tailored.summary).not.toBe(base.summary); // input not mutated
  });
});
