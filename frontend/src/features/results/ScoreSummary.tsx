"use client";

import { Popover } from "@base-ui/react/popover";
import { ArrowUp, Info } from "@phosphor-icons/react";
import { motion } from "motion/react";
import type { Scores } from "@/lib/api/types";
import { cn } from "@/lib/format";

type Props = { before: Scores | null; after: Scores };

/** A plain-language verdict for a 0-100 score. */
function verdict(score: number): { label: string; tone: "good" | "ok" | "low" } {
  if (score >= 75) return { label: "Strong", tone: "good" };
  if (score >= 50) return { label: "Fair", tone: "ok" };
  return { label: "Needs work", tone: "low" };
}

export function ScoreSummary({ before, after }: Props) {
  const match = after.match;
  const total =
    match.matchedMustHave.length +
    match.missingMustHave.length +
    match.matchedKeywords.length +
    match.missingKeywords.length +
    match.matchedNiceToHave.length +
    match.missingNiceToHave.length;
  const matched =
    match.matchedMustHave.length + match.matchedKeywords.length + match.matchedNiceToHave.length;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ScoreCard
        title="Job match"
        unit="%"
        before={before?.match.score ?? null}
        after={match.score}
        sentence={(b, a) =>
          b === null
            ? `Your resume covers ${a}% of what this job asks for.`
            : `Your resume now covers ${a}% of what this job asks for, up from ${b}%.`
        }
        detail={`${matched} of ${total} skills and keywords from the posting appear in your resume. Must-have skills count most.`}
        explainer="How much of the posting your resume covers. Must-have skills count three times, other keywords twice, nice-to-haves once. Missing items are listed in Keywords & scores, with honest suggestions."
      />
      <ScoreCard
        title="ATS readiness"
        unit=" / 100"
        before={before?.ats.score ?? null}
        after={after.ats.score}
        sentence={(b, a) =>
          b === null
            ? `Applicant tracking systems should read and rank this resume at ${a} out of 100.`
            : `Applicant tracking systems should rank it higher: ${a} out of 100, up from ${b}.`
        }
        detail="Checks keywords, job title, standard sections, contact details, numbers in bullets, action verbs and length."
        explainer="How well an applicant tracking system (ATS) can read and rank this resume for this job. Transparent and repeatable; no tool can see inside a specific employer's ATS. See the full breakdown in Keywords & scores."
      />
    </div>
  );
}

function ScoreCard({
  title,
  unit,
  before,
  after,
  sentence,
  detail,
  explainer,
}: {
  title: string;
  unit: string;
  before: number | null;
  after: number;
  sentence: (before: number | null, after: number) => string;
  detail: string;
  explainer: string;
}) {
  const change = before === null ? null : after - before;
  const { label, tone } = verdict(after);

  return (
    <section
      aria-label={title}
      className="rounded-[var(--radius-card)] border border-border bg-bg p-5 sm:p-6"
      data-surface
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-muted text-sm">{sentence(before, after)}</p>
        </div>
        <Popover.Root>
          <Popover.Trigger
            aria-label={`What ${title.toLowerCase()} means`}
            className="-m-1.5 grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Info aria-hidden className="size-5" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="end" sideOffset={6}>
              <Popover.Popup
                data-surface
                className="max-w-xs rounded-[var(--radius-control)] border border-border bg-bg p-4 text-sm shadow-card outline-none transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
              >
                <Popover.Title className="font-medium">{title}</Popover.Title>
                <Popover.Description className="mt-1 text-muted">{explainer}</Popover.Description>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
        {before !== null ? <Figure caption="Before" value={before} unit={unit} muted /> : null}
        <Figure caption={before === null ? "Score" : "After tailoring"} value={after} unit={unit} />
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {change !== null && change !== 0 ? (
            <span
              className={cn(
                "tabular inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-sm",
                change > 0 ? "bg-added-bg text-added" : "bg-removed-bg text-removed",
              )}
            >
              <ArrowUp
                aria-hidden
                weight="bold"
                className={cn("size-3.5", change < 0 && "rotate-180")}
              />
              {change > 0 ? "+" : "−"}
              {Math.abs(change)} points
            </span>
          ) : change === 0 ? (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted text-sm">
              No change
            </span>
          ) : null}
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 font-medium text-sm",
              tone === "good" && "border-added/50 text-added",
              tone === "ok" && "border-border-strong text-fg",
              tone === "low" && "border-warn/50 text-warn",
            )}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Two labelled bars instead of overlapping ones: no decoding needed. */}
      <dl className="mt-5 space-y-2">
        {before !== null ? <Bar label="Before" value={before} muted /> : null}
        <Bar label={before === null ? "Score" : "After"} value={after} animateFrom={before ?? 0} />
      </dl>

      <p className="mt-4 text-muted text-xs">{detail}</p>
    </section>
  );
}

function Figure({
  caption,
  value,
  unit,
  muted = false,
}: {
  caption: string;
  value: number;
  unit: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="font-medium text-muted text-xs uppercase tracking-wider">{caption}</p>
      <p
        className={cn(
          "tabular mt-1 font-semibold tracking-tight",
          muted ? "text-2xl text-muted" : "text-4xl",
        )}
      >
        {value}
        <span className="font-normal text-base text-muted">{unit}</span>
      </p>
    </div>
  );
}

function Bar({
  label,
  value,
  muted = false,
  animateFrom,
}: {
  label: string;
  value: number;
  muted?: boolean;
  animateFrom?: number;
}) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 text-xs">
      <dt className="text-muted">{label}</dt>
      <dd className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <motion.div
          className={cn("h-full rounded-full", muted ? "bg-border-strong" : "bg-fg")}
          initial={{ width: `${animateFrom ?? value}%` }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </dd>
      <dd className="tabular text-right text-muted">{value}</dd>
    </div>
  );
}
