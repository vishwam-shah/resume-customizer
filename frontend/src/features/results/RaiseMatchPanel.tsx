"use client";

import { Check, Plus, TrendUp } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import type { MatchScore } from "@/lib/api/types";
import { cn } from "@/lib/format";

type Props = {
  match: MatchScore;
  confirmed: string[];
  onToggle: (skill: string) => void;
  onCreateVersion: () => void;
  busy: boolean;
};

export const matchTarget = 90;

/**
 * The honest route to a high match: the candidate confirms skills they really
 * have but left off the resume. Confirmed skills go into Skills and the
 * summary of the next version; bullets still need evidence from that role.
 */
export function RaiseMatchPanel({ match, confirmed, onToggle, onCreateVersion, busy }: Props) {
  const missing = [
    ...match.missingMustHave.map((term) => ({ term, must: true })),
    ...match.missingKeywords.map((term) => ({ term, must: false })),
    ...match.missingNiceToHave.map((term) => ({ term, must: false })),
  ];
  if (missing.length === 0) return null;
  const count = confirmed.length;

  return (
    <section
      aria-labelledby="raise-heading"
      className="rounded-[var(--radius-card)] border border-border-strong bg-surface p-5 sm:p-6"
      data-surface
    >
      <h3 id="raise-heading" className="flex items-center gap-2 font-semibold text-lg">
        <TrendUp aria-hidden weight="bold" className="size-5" />
        {match.score >= matchTarget
          ? "Your match is strong"
          : `Raise your match toward ${matchTarget}%`}
      </h3>
      <p className="mt-1 max-w-3xl text-muted text-sm">
        These come from the job posting and aren't in your resume yet. Tick the ones you{" "}
        <strong className="font-semibold text-fg">genuinely have</strong>: the next version adds
        them to your Skills and summary. Only confirm what you could discuss in an interview.
      </p>

      <fieldset className="mt-4">
        <legend className="sr-only">Skills from the posting that you have</legend>
        <ul className="flex flex-wrap gap-2">
          {missing.map(({ term, must }) => {
            const on = confirmed.includes(term);
            return (
              <li key={term}>
                <label
                  className={cn(
                    "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
                    on
                      ? "border-fg bg-fg text-inverse-fg"
                      : "border-border-strong bg-bg hover:border-fg",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => onToggle(term)}
                  />
                  {on ? (
                    <Check aria-hidden weight="bold" className="size-4" />
                  ) : (
                    <Plus aria-hidden className="size-4" />
                  )}
                  {term}
                  {must ? (
                    <span className={cn("text-xs", on ? "opacity-80" : "text-muted")}>
                      must-have
                    </span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={onCreateVersion} disabled={count === 0} busy={busy} busyLabel="Creating…">
          {count === 0
            ? "Tick the skills you have"
            : `Create a version with ${count} confirmed skill${count === 1 ? "" : "s"}`}
        </Button>
        <p className="text-muted text-xs">
          Skills you don't have stay out. Bullets only mention a skill where that job actually used
          it.
        </p>
      </div>
    </section>
  );
}
