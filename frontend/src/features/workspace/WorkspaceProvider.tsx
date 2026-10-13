"use client";

import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { saveRun } from "@/features/history/actions";
import { ApiError, isAbort } from "@/lib/api/client";
import { streamEvents } from "@/lib/api/sse";
import type {
  DoneEvent,
  JobAnalysis,
  ResumeDoc,
  Scores,
  StageEvent,
  TailorRequest,
  TailorResult,
} from "@/lib/api/types";
import { useSession } from "@/lib/authClient";
import {
  initialState,
  type Version,
  type WorkspaceAction,
  type WorkspaceState,
  workspaceReducer,
} from "./workspaceState";

export const storageKey = "tailor.workspace.v1";

export type SaveStatus = "local" | "saving" | "saved" | "error";

type WorkspaceContextValue = {
  state: WorkspaceState;
  /** "local": signed out, kept in this browser only. */
  saveStatus: SaveStatus;
  dispatch: (action: WorkspaceAction) => void;
  startRun: () => Promise<void>;
  cancelRun: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const value = use(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return value;
}

/** Everything except transient run state survives a reload. */
function persist(state: WorkspaceState) {
  const { run: _run, ...rest } = state;
  try {
    localStorage.setItem(storageKey, JSON.stringify(rest));
  } catch {
    // Quota exceeded or storage blocked; the session still works in memory.
  }
}

function restore(): Partial<WorkspaceState> | null {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Partial<WorkspaceState>) : null;
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);
  const hydrated = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const saved = restore();
    if (saved) dispatch({ type: "hydrate", state: saved });
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const id = window.setTimeout(() => persist(state), 300);
    return () => window.clearTimeout(id);
  }, [state]);

  // Signed in: mirror the session to history, debounced, whenever it changes.
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("local");
  const { sessionId, versions, jobDescription, file, original, analysis, scoresBefore } = state;
  useEffect(() => {
    if (!signedIn) {
      setSaveStatus("local");
      return;
    }
    if (!sessionId || versions.length === 0 || !file || !analysis) return;
    setSaveStatus("saving");
    const id = window.setTimeout(async () => {
      try {
        const result = await saveRun({
          id: sessionId,
          data: { jobDescription, file, original, analysis, scoresBefore, versions },
        });
        setSaveStatus(result.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, 1200);
    return () => window.clearTimeout(id);
  }, [signedIn, sessionId, versions, jobDescription, file, original, analysis, scoresBefore]);

  const cancelRun = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    dispatch({ type: "runCancelled" });
  }, []);

  // Lets the error toast's "Try again" call the latest startRun.
  const startRunRef = useRef<() => Promise<void>>(async () => {});

  const startRun = useCallback(async () => {
    const current = stateRef.current;
    if (!current.file || current.run.status === "running") return;

    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    dispatch({ type: "runStarted" });

    const body: TailorRequest = {
      jobDescription: current.jobDescription,
      resumeText: current.file.text,
      resume: current.original,
      analysis: current.analysis,
      sections: current.options.sections,
      tone: current.options.tone,
    };

    let result: TailorResult | null = null;
    try {
      for await (const { event, data } of streamEvents("/api/v1/tailor", body, abort.signal)) {
        switch (event) {
          case "stage": {
            const stage = data as StageEvent;
            dispatch({ type: "stage", id: stage.id, status: stage.status });
            break;
          }
          case "resume":
            dispatch({ type: "resumeStructured", resume: data as ResumeDoc });
            break;
          case "analysis":
            dispatch({ type: "jobAnalyzed", analysis: data as JobAnalysis });
            break;
          case "scoresBefore":
            dispatch({ type: "scoredBefore", scores: data as Scores });
            break;
          case "result":
            result = data as TailorResult;
            break;
          case "done": {
            if (!result) break;
            const done = data as DoneEvent;
            const latest = stateRef.current;
            const version: Version = {
              id: crypto.randomUUID(),
              number: (latest.versions.at(-1)?.number ?? 0) + 1,
              createdAt: Date.now(),
              options: latest.options,
              result,
              model: done.model,
              durationMs: done.durationMs ?? 0,
              rejected: [],
              coverLetter: "",
            };
            dispatch({ type: "runSucceeded", version });
            const before = latest.scoresBefore?.match.score;
            toast.success("Your tailored resume is ready", {
              description:
                before === undefined
                  ? `Job match ${result.scores.match.score}%`
                  : `Job match ${before}% → ${result.scores.match.score}%`,
            });
            break;
          }
        }
      }
      if (!result) throw ApiError.fromUnknown(null);
    } catch (error) {
      if (isAbort(error)) return;
      const apiError = ApiError.fromUnknown(error);
      dispatch({ type: "runFailed", error: apiError });
      toast.error(apiError.message, {
        description: apiError.hint,
        duration: 12_000,
        action: { label: "Try again", onClick: () => void startRunRef.current() },
      });
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }, []);

  startRunRef.current = startRun;

  const value = useMemo(
    () => ({ state, saveStatus, dispatch, startRun, cancelRun }),
    [state, saveStatus, startRun, cancelRun],
  );
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}
