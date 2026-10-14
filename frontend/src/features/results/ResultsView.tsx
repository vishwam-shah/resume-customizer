"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Tabs } from "@base-ui/react/tabs";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import {
  ArrowLeft,
  Copy,
  PencilSimple,
  Plus,
  ShieldCheck,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonClasses } from "@/components/ui/Button";
import type { ResumeDoc } from "@/lib/api/types";
import { formatDuration, pluralize } from "@/lib/format";
import { CoverLetterPanel } from "../coverLetter/CoverLetterPanel";
import { SaveIndicator } from "../history/SaveIndicator";
import { LatexPanel } from "../latex/LatexPanel";
import { summarizeOptions, TailorOptionsPanel } from "../tailor/TailorOptionsPanel";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { activeVersion, maxVersions } from "../workspace/workspaceState";
import { ChangesView } from "./ChangesView";
import { applyChoices, computeChanges } from "./changes";
import { DownloadMenu } from "./DownloadMenu";
import { KeywordsView } from "./KeywordsView";
import { PagePreview } from "./PagePreview";
import { resumeToPlainText } from "./plainText";
import { RaiseMatchPanel } from "./RaiseMatchPanel";
import { ResumePreview } from "./ResumePreview";
import { ScoreSummary } from "./ScoreSummary";

const tabClass =
  "relative z-10 flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[calc(var(--radius-control)-2px)] px-4 font-medium text-muted text-sm hover:text-fg data-[active]:text-fg";

export function ResultsView() {
  const { state, saveStatus, dispatch, startRun } = useWorkspace();
  const version = activeVersion(state);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [tab, setTab] = useState("resume");
  const [previewMode, setPreviewMode] = useState<"page" | "text">("page");

  // Arriving at results (or switching version) moves focus to the heading.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-focus when the shown version changes
  useEffect(() => {
    headingRef.current?.focus();
  }, [version?.id]);

  const finalResume = useMemo(
    () =>
      version && state.original
        ? applyChoices(state.original, version.result.resume, version.rejected)
        : null,
    [version, state.original],
  );
  const changeCount = useMemo(
    () =>
      version && state.original ? computeChanges(state.original, version.result.resume).length : 0,
    [version, state.original],
  );

  if (!version || !state.original || !state.analysis || !finalResume) return null;
  const { result } = version;
  const analysis = state.analysis;
  const original = state.original;

  async function copyText(resume: ResumeDoc) {
    try {
      await navigator.clipboard.writeText(resumeToPlainText(resume));
      toast.success("Resume copied as plain text");
    } catch {
      toast.error("Couldn't access the clipboard", {
        description: "Use Download > Plain text instead.",
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-16 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        icon={<ArrowLeft aria-hidden className="size-4" />}
        onClick={() => dispatch({ type: "showView", view: "inputs" })}
      >
        Edit job or resume
      </Button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="font-mono text-subtle text-xs uppercase tracking-[0.14em]">
            Version {version.number} · {summarizeOptions(version.options)}
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 text-balance font-semibold text-3xl tracking-tight outline-none sm:text-4xl"
          >
            Tailored for {analysis.title}
            {analysis.company ? <span className="text-muted"> at {analysis.company}</span> : null}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-muted text-sm">
              Done in {formatDuration(version.durationMs)} with {version.model.split(":").at(-1)}
            </p>
            <SaveIndicator status={saveStatus} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewVersionDialog />
          <DownloadMenu
            build={(format) => ({
              kind: "resume",
              format,
              resume: finalResume,
            })}
          />
        </div>
      </div>

      {state.versions.length > 1 ? (
        <div className="mt-6">
          <p id="versions-label" className="sr-only">
            Choose a version
          </p>
          <ToggleGroup
            aria-labelledby="versions-label"
            value={[version.id]}
            onValueChange={(value) => {
              if (value[0]) dispatch({ type: "selectVersion", id: value[0] });
            }}
            className="inline-flex flex-wrap gap-1 rounded-[var(--radius-control)] border border-border bg-surface p-1"
          >
            {state.versions.map((v) => (
              <Toggle
                key={v.id}
                value={v.id}
                className="flex min-h-10 items-center gap-2 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm text-muted hover:text-fg data-[pressed]:bg-bg data-[pressed]:text-fg data-[pressed]:shadow-card"
              >
                <span className="font-medium">V{v.number}</span>
                <span className="tabular">{v.result.scores.match.score}% match</span>
              </Toggle>
            ))}
          </ToggleGroup>
        </div>
      ) : null}

      <div className="mt-8">
        <ScoreSummary
          before={state.scoresBefore}
          after={result.scores}
          onRaiseMatch={() => setTab("keywords")}
        />
      </div>

      <GuardNotice flags={result.flags} />

      <Tabs.Root value={tab} onValueChange={(value) => setTab(String(value))} className="mt-10">
        <Tabs.List
          aria-label="Results"
          className="relative grid w-full grid-cols-2 gap-1 rounded-[var(--radius-control)] border border-border bg-surface p-1 sm:inline-flex sm:w-auto"
        >
          <Tabs.Tab value="resume" className={tabClass}>
            Tailored resume
          </Tabs.Tab>
          <Tabs.Tab value="changes" className={tabClass}>
            Changes
            <span className="tabular rounded-full bg-surface-2 px-1.5 text-xs">{changeCount}</span>
          </Tabs.Tab>
          <Tabs.Tab value="keywords" className={tabClass}>
            Keywords &amp; scores
          </Tabs.Tab>
          <Tabs.Tab value="letter" className={tabClass}>
            Cover letter
          </Tabs.Tab>
          {state.latexSource ? (
            <Tabs.Tab value="latex" className={tabClass}>
              LaTeX
            </Tabs.Tab>
          ) : null}
          <Tabs.Indicator className="absolute top-[var(--active-tab-top)] left-[var(--active-tab-left)] z-0 h-[var(--active-tab-height)] w-[var(--active-tab-width)] rounded-[calc(var(--radius-control)-2px)] bg-bg shadow-card transition-all duration-200 ease-out" />
        </Tabs.List>

        <Tabs.Panel value="resume" className="mt-6 outline-none">
          <h2 className="sr-only">Tailored resume</h2>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              aria-label="Preview"
              value={[previewMode]}
              onValueChange={(value) => value[0] && setPreviewMode(value[0] as "page" | "text")}
              className="inline-flex rounded-[var(--radius-control)] border border-border bg-surface p-0.5"
            >
              {(["page", "text"] as const).map((mode) => (
                <Toggle
                  key={mode}
                  value={mode}
                  className="flex min-h-9 items-center rounded-[calc(var(--radius-control)-2px)] px-3 text-muted text-sm hover:text-fg data-[pressed]:bg-bg data-[pressed]:text-fg data-[pressed]:shadow-card"
                >
                  {mode === "page" ? "Page view" : "Text view"}
                </Toggle>
              ))}
            </ToggleGroup>
            <Button
              variant="ghost"
              size="sm"
              icon={<Copy aria-hidden className="size-4" />}
              onClick={() => copyText(finalResume)}
            >
              Copy as text
            </Button>
          </div>
          {previewMode === "page" ? (
            <PagePreview resume={finalResume} />
          ) : (
            <ResumePreview resume={finalResume} />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="changes" className="mt-6 outline-none">
          <h2 className="sr-only">Changes</h2>
          <ChangesView
            original={original}
            tailored={result.resume}
            rejected={version.rejected}
            onToggle={(key) => dispatch({ type: "toggleChange", key })}
            onSetAll={(keys, reject) => dispatch({ type: "setChanges", keys, reject })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="keywords" className="mt-6 outline-none">
          <h2 className="sr-only">Keywords and scores</h2>
          <div className="mb-10">
            <RaiseMatchPanel
              match={result.scores.match}
              confirmed={state.confirmedSkills ?? []}
              onToggle={(skill) => dispatch({ type: "toggleConfirmed", skill })}
              onCreateVersion={() => void startRun()}
              busy={state.run.status === "running"}
            />
          </div>
          <KeywordsView
            match={result.scores.match}
            ats={result.scores.ats}
            suggestions={result.suggestions}
            notes={result.notes}
          />
        </Tabs.Panel>

        <Tabs.Panel value="letter" className="mt-6 outline-none">
          <h2 className="sr-only">Cover letter</h2>
          <CoverLetterPanel
            jobDescription={state.jobDescription}
            resume={finalResume}
            analysis={analysis}
            text={version.coverLetter}
            onChange={(text) => dispatch({ type: "setCoverLetter", versionId: version.id, text })}
          />
        </Tabs.Panel>

        {state.latexSource ? (
          <Tabs.Panel value="latex" className="mt-6 outline-none">
            <h2 className="sr-only">Tailored LaTeX</h2>
            <LatexPanel
              source={state.latexSource}
              original={original}
              tailored={finalResume}
              edited={version.latexEdited ?? null}
              onEdit={(text) => dispatch({ type: "setLatexEdit", versionId: version.id, text })}
              fileStem={original.contact.name.replace(/[^A-Za-z0-9]+/g, "-")}
            />
          </Tabs.Panel>
        ) : null}
      </Tabs.Root>
    </div>
  );
}

function GuardNotice({ flags }: { flags: Array<{ message: string; itemId: string | null }> }) {
  if (flags.length === 0) {
    return (
      <p className="mt-6 flex items-start gap-2 text-muted text-sm">
        <ShieldCheck aria-hidden weight="duotone" className="mt-0.5 size-5 shrink-0 text-added" />
        Every rewritten line was checked against your original resume. No new numbers, employers or
        unproven skills were added.
      </p>
    );
  }
  return (
    <div className="mt-6 rounded-[var(--radius-card)] border border-warn/40 bg-warn-bg p-4 text-warn">
      <p className="flex items-center gap-2 font-medium">
        <WarningCircle aria-hidden weight="fill" className="size-5" />
        {pluralize(flags.length, "thing")} to double-check
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
        {flags.map((flag, index) => (
          <li key={`${index}-${flag.message}`}>{flag.message}</li>
        ))}
      </ul>
    </div>
  );
}

function NewVersionDialog() {
  const { state, dispatch, startRun } = useWorkspace();
  const [open, setOpen] = useState(false);
  const atCap = state.versions.length >= maxVersions;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={buttonClasses({ variant: "secondary" })}>
        <Plus aria-hidden className="size-4" />
        New version
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          data-surface
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-card)] border border-border bg-bg p-6 shadow-card outline-none transition-all duration-200 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-semibold text-xl">Create another version</Dialog.Title>
              <Dialog.Description className="mt-1 text-muted text-sm">
                Try different sections or a different tone, then compare versions side by side using
                the version switcher.
                {atCap
                  ? ` You can keep ${maxVersions} versions; the oldest one will be replaced.`
                  : ""}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-m-2 grid size-10 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          <div className="mt-5">
            <TailorOptionsPanel
              defaultOpen
              options={state.options}
              onChange={(options) => dispatch({ type: "setOptions", options })}
            />
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close className={buttonClasses({ variant: "ghost" })}>Cancel</Dialog.Close>
            <Button
              icon={<PencilSimple aria-hidden className="size-4" />}
              onClick={() => {
                setOpen(false);
                void startRun();
              }}
            >
              Create version {(state.versions.at(-1)?.number ?? 0) + 1}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
