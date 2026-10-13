"use client";

import { Popover } from "@base-ui/react/popover";
import { ArrowRight, Info } from "@phosphor-icons/react";
import { motion } from "motion/react";
import type { Scores } from "@/lib/api/types";
import { cn } from "@/lib/format";

type Props = { before: Scores | null; after: Scores };

export function ScoreSummary({ before, after }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ScoreCard
        label="Job match"
        suffix="%"
        before={before?.match.score ?? null}
        after={after.match.score}
        explainer="Share of the posting's skills and keywords your resume contains. Must-have skills count three times, other keywords twice, nice-to-haves once."
      />
      <ScoreCard
        label="ATS readiness"
        suffix="/100"
        before={before?.ats.score ?? null}
        after={after.ats.score}
        explainer="How well an applicant tracking system can read and rank the resume: keywords, title match, standard sections, contact details, quantified impact, action verbs and length. Transparent and repeatable; no tool can see inside a specific employer's ATS."
      />
    </div>
  );
}

function ScoreCard({
  label,
  suffix,
  before,
  after,
  explainer,
}: {
  label: string;
  suffix: string;
  before: number | null;
  after: number;
  explainer: string;
}) {
  const delta = before === null ? null : after - before;
  const deltaText =
    delta === null ? "" : delta > 0 ? `up ${delta}` : delta < 0 ? `down ${-delta}` : "unchanged";

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-bg p-5" data-surface>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-muted text-sm">{label}</h2>
        <Popover.Root>
          <Popover.Trigger
            aria-label={`How ${label.toLowerCase()} is calculated`}
            className="-m-2 grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Info aria-hidden className="size-4" />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner side="bottom" align="end" sideOffset={6}>
              <Popover.Popup
                data-surface
                className="max-w-xs rounded-[var(--radius-control)] border border-border bg-bg p-4 text-sm shadow-card outline-none transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
              >
                <Popover.Title className="font-medium">{label}</Popover.Title>
                <Popover.Description className="mt-1 text-muted">{explainer}</Popover.Description>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </div>

      <p className="mt-2 flex items-baseline gap-3">
        {before !== null ? (
          <>
            <span className="tabular text-2xl text-subtle">
              {before}
              <span className="sr-only">{suffix} before</span>
            </span>
            <ArrowRight aria-hidden className="size-4 self-center text-subtle" />
          </>
        ) : null}
        <span className="tabular font-semibold text-4xl tracking-tight">
          {after}
          <span className="font-normal text-lg text-muted">{suffix}</span>
          <span className="sr-only"> after tailoring</span>
        </span>
        {delta !== null && delta !== 0 ? (
          <span
            className={cn(
              "tabular rounded-full px-2 py-0.5 font-medium text-sm",
              delta > 0 ? "bg-added-bg text-added" : "bg-removed-bg text-removed",
            )}
          >
            <span aria-hidden>{delta > 0 ? `+${delta}` : delta}</span>
            <span className="sr-only">, {deltaText}</span>
          </span>
        ) : null}
      </p>

      <div aria-hidden className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
        {before !== null ? (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-border-strong"
            style={{ width: `${before}%` }}
          />
        ) : null}
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-fg"
          initial={{ width: `${before ?? 0}%` }}
          animate={{ width: `${after}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </div>
    </div>
  );
}
