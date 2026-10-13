"use client";

import { CheckCircle, Circle } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@/components/ui/Button";
import type { StageId } from "@/lib/api/types";
import { cn, pluralize } from "@/lib/format";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { stageOrder } from "../workspace/workspaceState";

const stageCopy: Record<StageId, { label: string; active: string }> = {
  reading: { label: "Read your resume", active: "Reading your resume" },
  analyzing: {
    label: "Analyze the job",
    active: "Finding what the job asks for",
  },
  scoring: {
    label: "Score the original",
    active: "Scoring your current resume",
  },
  tailoring: {
    label: "Tailor your resume",
    active: "Rewriting the sections you chose",
  },
  checking: {
    label: "Check every claim",
    active: "Checking nothing was invented",
  },
};

function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);
  return seconds;
}

export function ProgressPanel() {
  const { state, cancelRun } = useWorkspace();
  const { stages } = state.run;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const seconds = useElapsedSeconds();
  const active = stageOrder.find((id) => stages[id] === "active");
  const doneCount = stageOrder.filter((id) => stages[id] === "done").length;

  useEffect(() => headingRef.current?.focus(), []);

  const findings: Partial<Record<StageId, string>> = {
    analyzing: state.analysis
      ? `${state.analysis.title}${state.analysis.company ? ` at ${state.analysis.company}` : ""}: ${pluralize(state.analysis.mustHaveSkills.length, "must-have skill")}`
      : undefined,
    reading: state.original
      ? `${state.original.contact.name}: ${pluralize(state.original.experience.length, "role")}, ${pluralize(
          state.original.skills.reduce((n, g) => n + g.items.length, 0),
          "skill",
        )}`
      : undefined,
    scoring: state.scoresBefore
      ? `Current match ${state.scoresBefore.match.score}%, ATS readiness ${state.scoresBefore.ats.score}`
      : undefined,
  };

  return (
    <section
      aria-labelledby="progress-heading"
      className="mx-auto w-full max-w-xl rounded-[var(--radius-card)] border border-border bg-bg p-6 shadow-card sm:p-8"
      data-surface
    >
      <h2
        id="progress-heading"
        ref={headingRef}
        tabIndex={-1}
        className="font-semibold text-xl tracking-tight outline-none"
      >
        Tailoring your resume
      </h2>
      <p className="mt-1 text-muted text-sm">
        Usually 10 to 30 seconds. You can keep this tab in the background.
      </p>

      {/* One concise, polite announcement per stage change. */}
      <p role="status" className="sr-only">
        {active
          ? `${stageCopy[active].active}. Step ${doneCount + 1} of ${stageOrder.length}.`
          : ""}
      </p>

      <div aria-hidden className="mt-6 h-1 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full rounded-full bg-fg"
          initial={false}
          animate={{
            width: `${Math.max(6, (doneCount / stageOrder.length) * 100)}%`,
          }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
        />
      </div>

      <ol className="mt-6 space-y-1">
        {stageOrder.map((id) => {
          const status = stages[id];
          const finding = findings[id];
          return (
            <li
              key={id}
              aria-current={status === "active" ? "step" : undefined}
              className={cn(
                "flex items-start gap-3 rounded-md px-2 py-2.5",
                status === "active" && "bg-surface",
              )}
            >
              <span className="mt-0.5 grid size-5 place-items-center">
                {status === "done" ? (
                  <CheckCircle weight="fill" className="size-5 text-fg" aria-label="Done" />
                ) : status === "active" ? (
                  <Spinner className="size-4 text-fg" />
                ) : (
                  <Circle className="size-5 text-subtle" aria-label="Waiting" />
                )}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm", status === "pending" ? "text-muted" : "font-medium")}>
                  {status === "active" ? `${stageCopy[id].active}…` : stageCopy[id].label}
                </p>
                {finding && status === "done" ? (
                  <motion.p
                    initial={{ opacity: 0, y: -2 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-0.5 text-muted text-sm"
                  >
                    {finding}
                  </motion.p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="tabular text-subtle text-sm" aria-hidden>
          {seconds}s
        </p>
        <Button variant="secondary" onClick={cancelRun}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
