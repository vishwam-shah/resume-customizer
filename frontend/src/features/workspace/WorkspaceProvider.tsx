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
} from "react";
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
import {
  initialState,
  type Version,
  type WorkspaceAction,
  type WorkspaceState,
  workspaceReducer,
} from "./workspaceState";

const storageKey = "tailor.workspace.v1";

type WorkspaceContextValue = {
  state: WorkspaceState;
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

  const cancelRun = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    dispatch({ type: "runCancelled" });
  }, []);

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
            break;
          }
        }
      }
      if (!result) throw ApiError.fromUnknown(null);
    } catch (error) {
      if (isAbort(error)) return;
      dispatch({ type: "runFailed", error: ApiError.fromUnknown(error) });
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, startRun, cancelRun }),
    [state, startRun, cancelRun],
  );
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}
