"use client";

import { CheckCircle, Lightbulb, MinusCircle, Sparkle } from "@phosphor-icons/react";
import type { AtsScore, KeywordSuggestion, MatchScore } from "@/lib/api/types";
import { cn } from "@/lib/format";
import { sectionLabels } from "../tailor/TailorOptionsPanel";

type Props = {
  match: MatchScore;
  ats: AtsScore;
  suggestions: KeywordSuggestion[];
  notes: string[];
};

export function KeywordsView({ match, ats, suggestions, notes }: Props) {
  const groups = [
    {
      title: "Must-have skills",
      matched: match.matchedMustHave,
      missing: match.missingMustHave,
    },
    {
      title: "Posting keywords",
      matched: match.matchedKeywords,
      missing: match.missingKeywords,
    },
    {
      title: "Nice to have",
      matched: match.matchedNiceToHave,
      missing: match.missingNiceToHave,
    },
  ].filter((g) => g.matched.length + g.missing.length > 0);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-10">
        <section aria-labelledby="coverage-heading">
          <h3 id="coverage-heading" className="font-semibold text-lg">
            Keyword coverage
          </h3>
          <div className="mt-4 space-y-6">
            {groups.map((group) => (
              <div key={group.title}>
                <h4 className="font-medium text-sm">
                  {group.title}
                  <span className="ml-2 text-muted">
                    {group.matched.length} of {group.matched.length + group.missing.length}
                  </span>
                </h4>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {group.matched.map((term) => (
                    <Chip key={term} term={term} present />
                  ))}
                  {group.missing.map((term) => (
                    <Chip key={term} term={term} present={false} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {suggestions.length > 0 ? (
          <section aria-labelledby="suggestions-heading">
            <h3 id="suggestions-heading" className="flex items-center gap-2 font-semibold text-lg">
              <Lightbulb aria-hidden weight="duotone" className="size-5" />
              Worth adding, if it's true
            </h3>
            <p className="mt-1 text-muted text-sm">
              We never add these for you. Add one only if you can talk about it in an interview.
            </p>
            <ul className="mt-4 divide-y divide-border rounded-[var(--radius-card)] border border-border">
              {suggestions.map((s, index) => (
                <li key={`${index}-${s.keyword}`} className="p-4">
                  <p className="font-medium">
                    {s.keyword}
                    <span className="ml-2 font-normal text-muted text-sm">
                      in {sectionLabels[s.section]}
                    </span>
                  </p>
                  <p className="mt-1 text-muted text-sm">{s.suggestion}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="space-y-10">
        <section aria-labelledby="ats-heading">
          <h3 id="ats-heading" className="font-semibold text-lg">
            ATS breakdown
          </h3>
          <dl className="mt-4 space-y-4">
            {ats.components.map((c) => (
              <div key={c.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="font-medium">{c.label}</dt>
                  <dd className="tabular text-muted">
                    {Math.round(c.points)} / {c.maxPoints}
                  </dd>
                </div>
                <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-fg"
                    style={{ width: `${(c.points / c.maxPoints) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-muted text-xs">{c.detail}</p>
              </div>
            ))}
          </dl>
          {ats.issues.length > 0 ? (
            <ul className="mt-5 space-y-2 text-sm">
              {ats.issues.map((issue, index) => (
                <li
                  key={`${index}-${issue}`}
                  className="flex gap-2 rounded-md bg-warn-bg px-3 py-2 text-warn"
                >
                  <span aria-hidden>•</span>
                  {issue}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {notes.length > 0 ? (
          <section aria-labelledby="notes-heading">
            <h3 id="notes-heading" className="flex items-center gap-2 font-semibold text-lg">
              <Sparkle aria-hidden weight="duotone" className="size-5" />
              What changed and why
            </h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted text-sm">
              {notes.map((note, index) => (
                <li key={`${index}-${note}`}>{note}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Chip({ term, present }: { term: string; present: boolean }) {
  return (
    <li
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-sm",
        present ? "border-border-strong bg-bg" : "border-dashed border-border-strong text-muted",
      )}
    >
      {present ? (
        <CheckCircle weight="fill" aria-hidden className="size-4 text-added" />
      ) : (
        <MinusCircle aria-hidden className="size-4" />
      )}
      {term}
      <span className="sr-only">{present ? ", in your resume" : ", missing"}</span>
    </li>
  );
}
