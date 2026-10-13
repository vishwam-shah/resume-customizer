"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ArrowArcLeft, ArrowsDownUp, Check } from "@phosphor-icons/react";
import { diffWords } from "diff";
import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import type { ResumeDoc, Section } from "@/lib/api/types";
import { cn, pluralize } from "@/lib/format";
import { sectionLabels } from "../tailor/TailorOptionsPanel";
import { type Change, computeChanges } from "./changes";
import { DiffText } from "./DiffText";

type Props = {
  original: ResumeDoc;
  tailored: ResumeDoc;
  rejected: string[];
  onToggle: (key: string) => void;
  onSetAll: (keys: string[], reject: boolean) => void;
};

const ordinal = (n: number) => ["1st", "2nd", "3rd"][n] ?? `${n + 1}th`;

export function ChangesView({ original, tailored, rejected, onToggle, onSetAll }: Props) {
  const changes = useMemo(() => computeChanges(original, tailored), [original, tailored]);
  const groups = useMemo(() => {
    const bySection = new Map<Section, Change[]>();
    for (const change of changes) {
      bySection.set(change.section, [...(bySection.get(change.section) ?? []), change]);
    }
    return [...bySection.entries()];
  }, [changes]);
  const rejectedCount = changes.filter((c) => rejected.includes(c.key)).length;

  if (changes.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-border p-8 text-center text-muted">
        No changes were needed for the sections you chose.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted" aria-live="polite">
          {pluralize(changes.length, "change")}
          {rejectedCount > 0 ? `, ${rejectedCount} reverted to your original wording` : ""}. Your
          downloads use exactly what you keep here.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={rejectedCount === 0}
            onClick={() =>
              onSetAll(
                changes.map((c) => c.key),
                false,
              )
            }
          >
            Keep all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={rejectedCount === changes.length}
            onClick={() =>
              onSetAll(
                changes.map((c) => c.key),
                true,
              )
            }
          >
            Revert all
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-muted text-sm" aria-hidden>
        <span>
          <ins className="bg-added-bg text-added underline">Added</ins> words are underlined
        </span>
        <span>
          <del className="bg-removed-bg text-removed line-through">Removed</del> words are struck
          through
        </span>
      </div>

      <div className="mt-6 space-y-8">
        {groups.map(([section, items]) => (
          <section key={section} aria-labelledby={`changes-${section}`}>
            <h3 id={`changes-${section}`} className="font-semibold text-lg">
              {sectionLabels[section]}
              <span className="ml-2 font-normal text-muted text-sm">
                {pluralize(items.length, "change")}
              </span>
            </h3>
            <ul className="mt-3 space-y-3">
              {items.map((change) => (
                <ChangeRow
                  key={change.key}
                  change={change}
                  reverted={rejected.includes(change.key)}
                  onToggle={() => onToggle(change.key)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** True when less than half the original wording survives: an inline diff would be noise. */
function isRewrite({ before, after }: Change): boolean {
  const kept = diffWords(before, after)
    .filter((part) => !part.added && !part.removed)
    .reduce((n, part) => n + part.value.trim().length, 0);
  return kept / Math.max(1, before.replace(/\s+/g, "").length) < 0.5;
}

/** Heavy rewrites and restructured lists read better as two clean blocks. */
function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <div className="rounded-[var(--radius-control)] bg-surface p-3">
        <p className="font-medium text-muted text-xs uppercase tracking-wider">Before</p>
        <p className="mt-1.5 whitespace-pre-line text-muted leading-relaxed">{before}</p>
      </div>
      <div className="rounded-[var(--radius-control)] border border-added/40 bg-added-bg p-3">
        <p className="font-medium text-added text-xs uppercase tracking-wider">After</p>
        <p className="mt-1.5 whitespace-pre-line leading-relaxed">{after}</p>
      </div>
    </div>
  );
}

function ChangeRow({
  change,
  reverted,
  onToggle,
}: {
  change: Change;
  reverted: boolean;
  onToggle: () => void;
}) {
  const showLabel = change.section === "experience" || change.section === "projects";
  return (
    <li
      className={cn(
        "rounded-[var(--radius-card)] border p-4 transition-colors sm:p-5",
        reverted ? "border-border bg-surface" : "border-border-strong bg-bg",
      )}
      data-surface
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-muted text-sm">
          {showLabel ? <p className="font-medium text-fg">{change.label}</p> : null}
          {change.moved ? (
            <p className="mt-0.5 inline-flex items-center gap-1">
              <ArrowsDownUp aria-hidden className="size-3.5" />
              Moved from {ordinal(change.moved.from)} to {ordinal(change.moved.to)} position
            </p>
          ) : null}
        </div>
        {/* Stable name; aria-pressed carries the state ("Use original, pressed"). */}
        <Toggle
          pressed={reverted}
          onPressedChange={onToggle}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border border-border-strong px-3 font-medium text-sm hover:bg-surface-2 data-[pressed]:border-fg data-[pressed]:bg-fg data-[pressed]:text-inverse-fg"
        >
          {reverted ? (
            <Check aria-hidden className="size-4" />
          ) : (
            <ArrowArcLeft aria-hidden className="size-4" />
          )}
          Use original
        </Toggle>
      </div>

      {reverted ? (
        <p className="mt-3 whitespace-pre-line text-muted leading-relaxed">{change.before}</p>
      ) : change.before && (change.section === "skills" || isRewrite(change)) ? (
        <BeforeAfter before={change.before} after={change.after} />
      ) : (
        <p className="mt-3 whitespace-pre-line leading-relaxed">
          {change.before ? <DiffText before={change.before} after={change.after} /> : change.after}
        </p>
      )}
    </li>
  );
}
