"use client";

import { ArrowRight, Flask, WarningOctagon } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ParsedFile } from "@/lib/api/types";
import { checkJobDescription } from "@/lib/limits";
import { sampleJobDescription, sampleResumeName, sampleResumeUrl } from "@/lib/sampleData";
import { JobDescriptionField } from "../jobInput/JobDescriptionField";
import { ResumeDropzone } from "../resumeUpload/ResumeDropzone";
import { useResumeUpload } from "../resumeUpload/useResumeUpload";
import { TailorOptionsPanel } from "../tailor/TailorOptionsPanel";
import { useWorkspace } from "./WorkspaceProvider";

type FieldErrors = { job: string | null; resume: string | null };

export function InputsView() {
  const { state, dispatch, startRun } = useWorkspace();
  const [attempted, setAttempted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const runErrorRef = useRef<HTMLDivElement>(null);
  const {
    upload,
    uploadingName,
    error: uploadError,
    clearError,
  } = useResumeUpload((file: ParsedFile) => dispatch({ type: "setFile", file }));

  const errors: FieldErrors = {
    job: checkJobDescription(state.jobDescription),
    resume: state.file ? null : "Upload your resume.",
  };
  const visibleErrors: FieldErrors = attempted ? errors : { job: null, resume: null };
  const errorList = [
    visibleErrors.job && {
      href: "#job-description-field",
      text: visibleErrors.job,
    },
    visibleErrors.resume && {
      href: "#resume-field",
      text: visibleErrors.resume,
    },
  ].filter(Boolean) as Array<{ href: string; text: string }>;

  const runError = state.run.status === "error" ? state.run.error : null;
  useEffect(() => {
    if (runError) runErrorRef.current?.focus();
  }, [runError]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    setAttempted(true);
    if (errors.job || errors.resume || uploadingName) {
      // Let the summary render, then move focus to it so it is announced.
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    void startRun();
  }

  async function loadExample() {
    dispatch({ type: "setJobDescription", value: sampleJobDescription });
    const response = await fetch(sampleResumeUrl);
    const blob = await response.blob();
    await upload(new File([blob], sampleResumeName, { type: "application/pdf" }));
  }

  const hasPreviousResults = state.versions.length > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
      <div className="max-w-2xl">
        <h1 className="text-balance font-semibold text-4xl tracking-tight sm:text-5xl">
          Tailor your resume to the job.
        </h1>
        <p className="mt-4 text-pretty text-lg text-muted">
          Paste a job description and upload your resume. You get a version that speaks the job's
          language, with every change traceable to something you actually did.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            icon={<Flask aria-hidden className="size-4" />}
            onClick={loadExample}
          >
            Try an example
          </Button>
          {hasPreviousResults ? (
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "showView", view: "results" })}
              icon={<ArrowRight aria-hidden className="size-4" />}
            >
              Back to your results
            </Button>
          ) : null}
        </div>
      </div>

      {runError ? (
        <div
          ref={runErrorRef}
          tabIndex={-1}
          role="alert"
          className="mt-8 flex items-start gap-3 rounded-[var(--radius-card)] border border-removed bg-removed-bg p-4 outline-none"
        >
          <WarningOctagon
            aria-hidden
            weight="fill"
            className="mt-0.5 size-5 shrink-0 text-removed"
          />
          <div className="flex-1">
            <p className="font-medium text-removed">{runError.message}</p>
            <p className="mt-0.5 text-fg text-sm">{runError.hint}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void startRun()}>
            Try again
          </Button>
        </div>
      ) : null}

      {errorList.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          aria-labelledby="error-summary-title"
          className="mt-8 rounded-[var(--radius-card)] bg-danger-solid p-5 text-on-danger shadow-card outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
        >
          <h2 id="error-summary-title" className="flex items-center gap-2 font-semibold">
            <WarningOctagon aria-hidden weight="fill" className="size-5 shrink-0" />
            Fix {errorList.length === 1 ? "this" : "these"} to continue
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-12 marker:text-on-danger">
            {errorList.map((e) => (
              <li key={e.href}>
                <a
                  href={e.href}
                  onClick={(event) => {
                    // Jump straight to the control, not just its card.
                    const control = document.querySelector<HTMLElement>(
                      `${e.href} textarea, ${e.href} button`,
                    );
                    if (!control) return;
                    event.preventDefault();
                    control.focus();
                    control.scrollIntoView({ block: "center" });
                  }}
                  className="text-on-danger underline decoration-2 underline-offset-4 hover:decoration-[3px]"
                >
                  {e.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={submit} noValidate className="mt-10" aria-label="Tailor your resume">
        <div className="grid gap-6 lg:grid-cols-2">
          <StepCard number={1} id="job-description-field">
            <JobDescriptionField
              value={state.jobDescription}
              onChange={(value) => dispatch({ type: "setJobDescription", value })}
              error={visibleErrors.job}
              onSubmitShortcut={submit}
            />
          </StepCard>
          <StepCard number={2} id="resume-field">
            <ResumeDropzone
              file={state.file}
              uploadingName={uploadingName}
              error={uploadError}
              requiredError={uploadError ? null : visibleErrors.resume}
              onSelect={(file) => void upload(file)}
              onRemove={() => {
                clearError();
                dispatch({ type: "setFile", file: null });
              }}
            />
          </StepCard>
        </div>

        <div className="mt-6">
          <TailorOptionsPanel
            options={state.options}
            onChange={(options) => dispatch({ type: "setOptions", options })}
          />
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-border border-t bg-bg/90 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
            <p className="hidden text-subtle text-sm sm:block">
              <kbd className="font-mono">Ctrl</kbd> + <kbd className="font-mono">Enter</kbd> to
              submit from the job description
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={Boolean(uploadingName)}
              icon={<ArrowRight aria-hidden className="size-5" />}
              className="sm:min-w-56"
            >
              Tailor my resume
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function StepCard({
  number,
  id,
  children,
}: {
  number: number;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="relative rounded-[var(--radius-card)] border border-border bg-bg p-5 sm:p-6"
      data-surface
    >
      <span
        aria-hidden
        className="absolute -top-3 left-5 grid size-6 place-items-center rounded-full bg-fg font-mono font-semibold text-inverse-fg text-xs"
      >
        {number}
      </span>
      {children}
    </div>
  );
}
