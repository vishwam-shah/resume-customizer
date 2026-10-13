import type { ResumeDoc, Section, SkillGroup } from "@/lib/api/types";

export type Change = {
  key: string;
  section: Section;
  /** Where it lives, in words: "Summary", "AI Engineer, HunterRepo". */
  label: string;
  before: string;
  after: string;
  /** Position change for reordered bullets, e.g. moved from 3rd to 1st. */
  moved: { from: number; to: number } | null;
};

const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []);

function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.max(wa.size, wb.size);
}

/**
 * For each tailored bullet, the index of the original it was rewritten from.
 * Bullets are reordered, so pair greedily by best word overlap, one-to-one.
 */
export function pairBullets(original: string[], tailored: string[]): number[] {
  const scores: Array<[number, number, number]> = [];
  tailored.forEach((t, ti) => {
    original.forEach((o, oi) => {
      scores.push([similarity(t, o), ti, oi]);
    });
  });
  scores.sort((a, b) => b[0] - a[0]);
  const pairs = new Array<number>(tailored.length).fill(-1);
  const used = new Set<number>();
  for (const [, ti, oi] of scores) {
    if (pairs[ti] === -1 && !used.has(oi)) {
      pairs[ti] = oi;
      used.add(oi);
    }
  }
  return pairs;
}

const skillsText = (groups: SkillGroup[]) =>
  groups.map((g) => `${g.name}: ${g.items.join(", ")}`).join("\n");

export function computeChanges(original: ResumeDoc, tailored: ResumeDoc): Change[] {
  const changes: Change[] = [];

  if ((original.summary ?? "") !== (tailored.summary ?? "")) {
    changes.push({
      key: "summary",
      section: "summary",
      label: "Summary",
      before: original.summary ?? "",
      after: tailored.summary ?? "",
      moved: null,
    });
  }

  const beforeSkills = skillsText(original.skills);
  const afterSkills = skillsText(tailored.skills);
  if (beforeSkills !== afterSkills) {
    changes.push({
      key: "skills",
      section: "skills",
      label: "Skills",
      before: beforeSkills,
      after: afterSkills,
      moved: null,
    });
  }

  const entries = [
    ...original.experience.map((e) => ({
      section: "experience" as const,
      item: e,
      label: `${e.role}, ${e.company}`,
      after: tailored.experience.find((t) => t.id === e.id)?.bullets,
    })),
    ...original.projects.map((p) => ({
      section: "projects" as const,
      item: p,
      label: p.name,
      after: tailored.projects.find((t) => t.id === p.id)?.bullets,
    })),
  ];

  for (const { section, item, label, after } of entries) {
    if (!after) continue;
    const pairs = pairBullets(item.bullets, after);
    after.forEach((text, index) => {
      const from = pairs[index];
      const before = from >= 0 ? item.bullets[from] : "";
      if (before === text && from === index) return;
      changes.push({
        key: `${item.id}:${index}`,
        section,
        label,
        before,
        after: text,
        moved: from >= 0 && from !== index ? { from, to: index } : null,
      });
    });
  }
  return changes;
}

/** The resume the user actually downloads: tailored, minus rejected changes. */
export function applyChoices(
  original: ResumeDoc,
  tailored: ResumeDoc,
  rejected: string[],
): ResumeDoc {
  if (rejected.length === 0) return tailored;
  const reject = new Set(rejected);
  const result: ResumeDoc = structuredClone(tailored);

  if (reject.has("summary")) result.summary = original.summary;
  if (reject.has("skills")) result.skills = structuredClone(original.skills);

  const revert = (
    items: Array<{ id: string; bullets: string[] }>,
    originals: Array<{ id: string; bullets: string[] }>,
  ) => {
    for (const item of items) {
      const source = originals.find((o) => o.id === item.id);
      if (!source) continue;
      const pairs = pairBullets(source.bullets, item.bullets);
      item.bullets = item.bullets.map((text, index) =>
        reject.has(`${item.id}:${index}`) && pairs[index] >= 0
          ? source.bullets[pairs[index]]
          : text,
      );
    }
  };
  revert(result.experience, original.experience);
  revert(result.projects, original.projects);
  return result;
}
