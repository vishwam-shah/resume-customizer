import type { ResumeDoc } from "@/lib/api/types";

const range = (start: string | null, end: string | null) =>
  start && end ? `${start} – ${end}` : (start ?? end ?? "");

// Index keys: these lists come from server data, never reorder, and may repeat text.

/** The tailored resume as a document, mirroring the PDF's single-column layout. */
export function ResumePreview({ resume }: { resume: ResumeDoc }) {
  const { contact } = resume;
  const contactParts = [contact.email, contact.phone, contact.location].filter(Boolean);

  return (
    <article
      aria-label={`Tailored resume for ${contact.name}`}
      className="mx-auto max-w-[52rem] rounded-[var(--radius-card)] border border-border bg-bg px-5 py-7 font-serif text-[0.9375rem] leading-relaxed shadow-card sm:px-12 sm:py-12"
      data-surface
    >
      <header>
        <h3 className="font-sans font-semibold text-3xl tracking-tight">{contact.name}</h3>
        {contact.headline ? <p className="mt-1 text-lg">{contact.headline}</p> : null}
        <p className="mt-2 font-sans text-muted text-sm">
          {contactParts.join(" · ")}
          {contact.links.map((link) => (
            <span key={link.url}>
              {" · "}
              <a href={link.url} className="underline underline-offset-2 hover:text-fg">
                {link.label}
              </a>
            </span>
          ))}
        </p>
      </header>

      {resume.summary ? (
        <Section title="Summary">
          <p>{resume.summary}</p>
        </Section>
      ) : null}

      {resume.skills.length > 0 ? (
        <Section title="Skills">
          <dl className="space-y-1">
            {resume.skills.map((group) => (
              <div key={group.name} className="sm:flex sm:gap-2">
                <dt className="shrink-0 font-semibold">{group.name}:</dt>
                <dd>{group.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {resume.experience.length > 0 ? (
        <Section title="Experience">
          <div className="space-y-5">
            {resume.experience.map((job) => (
              <Entry
                key={job.id}
                title={`${job.role}, ${job.company}`}
                meta={[job.location, range(job.start, job.end)].filter(Boolean).join(" · ")}
                bullets={job.bullets}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {resume.projects.length > 0 ? (
        <Section title="Projects">
          <div className="space-y-5">
            {resume.projects.map((project) => (
              <Entry
                key={project.id}
                title={project.name}
                meta={project.link ?? ""}
                bullets={project.bullets}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {resume.education.length > 0 ? (
        <Section title="Education">
          <div className="space-y-4">
            {resume.education.map((ed) => (
              <Entry
                key={ed.id}
                title={`${ed.degree}, ${ed.school}`}
                meta={[ed.location, range(ed.start, ed.end)].filter(Boolean).join(" · ")}
                bullets={ed.details}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {resume.extras
        .filter((extra) => extra.items.length > 0)
        .map((extra) => (
          <Section key={extra.title} title={extra.title}>
            <ul className="list-disc space-y-1 pl-5">
              {extra.items.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </Section>
        ))}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h4 className="mb-3 border-border border-b pb-1.5 font-sans font-semibold text-xs uppercase tracking-[0.14em]">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Entry({ title, meta, bullets }: { title: string; meta: string; bullets: string[] }) {
  return (
    <div>
      <div className="sm:flex sm:items-baseline sm:justify-between sm:gap-4">
        <p className="font-semibold">{title}</p>
        {meta ? <p className="shrink-0 font-sans text-muted text-sm">{meta}</p> : null}
      </div>
      {bullets.length > 0 ? (
        <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-subtle">
          {bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
