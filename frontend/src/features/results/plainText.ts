import type { ResumeDoc } from "@/lib/api/types";

/** Plain text for pasting into application forms; mirrors the backend's .txt export. */
export function resumeToPlainText(doc: ResumeDoc): string {
  const lines: string[] = [doc.contact.name];
  if (doc.contact.headline) lines.push(doc.contact.headline);
  const contact = [
    doc.contact.email,
    doc.contact.phone,
    doc.contact.location,
    ...doc.contact.links.map((l) => l.url),
  ]
    .filter(Boolean)
    .join(" | ");
  if (contact) lines.push(contact);
  if (doc.summary) lines.push("", "SUMMARY", doc.summary);
  if (doc.skills.length) {
    lines.push("", "SKILLS", ...doc.skills.map((g) => `${g.name}: ${g.items.join(", ")}`));
  }
  const dates = (start: string | null, end: string | null) =>
    start && end ? `${start} to ${end}` : (start ?? end ?? "");
  if (doc.experience.length) {
    lines.push("", "EXPERIENCE");
    for (const job of doc.experience) {
      const meta = [job.location, dates(job.start, job.end)].filter(Boolean).join(" | ");
      lines.push(
        `${job.role}, ${job.company}${meta ? ` (${meta})` : ""}`,
        ...job.bullets.map((b) => `- ${b}`),
      );
    }
  }
  if (doc.projects.length) {
    lines.push("", "PROJECTS");
    for (const project of doc.projects) {
      lines.push(
        project.link ? `${project.name} (${project.link})` : project.name,
        ...project.bullets.map((b) => `- ${b}`),
      );
    }
  }
  if (doc.education.length) {
    lines.push("", "EDUCATION");
    for (const ed of doc.education) {
      const meta = [ed.location, dates(ed.start, ed.end)].filter(Boolean).join(" | ");
      lines.push(
        `${ed.degree}, ${ed.school}${meta ? ` (${meta})` : ""}`,
        ...ed.details.map((d) => `- ${d}`),
      );
    }
  }
  for (const extra of doc.extras) {
    if (extra.items.length)
      lines.push("", extra.title.toUpperCase(), ...extra.items.map((i) => `- ${i}`));
  }
  return lines.join("\n").trim();
}
