import type { ApiError } from "@/lib/api/client";
import type {
  JobAnalysis,
  ParsedFile,
  ResumeDoc,
  Scores,
  Section,
  StageId,
  TailorResult,
  Tone,
} from "@/lib/api/types";

export const allSections: Section[] = ["summary", "skills", "experience", "projects"];
export const stageOrder: StageId[] = ["reading", "analyzing", "scoring", "tailoring", "checking"];
export const maxVersions = 3;

export type StageStatus = "pending" | "active" | "done";

export type TailorOptions = { sections: Section[]; tone: Tone };

export type Version = {
  id: string;
  number: number;
  createdAt: number;
  options: TailorOptions;
  result: TailorResult;
  model: string;
  durationMs: number;
  /** Change keys the user reverted to the original wording. */
  rejected: string[];
  coverLetter: string;
};

export type WorkspaceState = {
  jobDescription: string;
  file: ParsedFile | null;
  options: TailorOptions;
  /** Cached between versions so a new version skips re-reading the inputs. */
  original: ResumeDoc | null;
  analysis: JobAnalysis | null;
  scoresBefore: Scores | null;
  run: {
    status: "idle" | "running" | "error";
    stages: Record<StageId, StageStatus>;
    error: ApiError | null;
  };
  versions: Version[];
  activeVersionId: string | null;
  /** Identifies this job + resume session in saved history. */
  sessionId: string | null;
  view: "inputs" | "results";
};

const idleStages = (): Record<StageId, StageStatus> =>
  Object.fromEntries(stageOrder.map((id) => [id, "pending"])) as Record<StageId, StageStatus>;

export const initialState: WorkspaceState = {
  jobDescription: "",
  file: null,
  options: { sections: allSections, tone: "balanced" },
  original: null,
  analysis: null,
  scoresBefore: null,
  run: { status: "idle", stages: idleStages(), error: null },
  versions: [],
  activeVersionId: null,
  sessionId: null,
  view: "inputs",
};

export type WorkspaceAction =
  | { type: "hydrate"; state: Partial<WorkspaceState> }
  | { type: "setJobDescription"; value: string }
  | { type: "setFile"; file: ParsedFile | null }
  | { type: "setOptions"; options: Partial<TailorOptions> }
  | { type: "runStarted" }
  | { type: "stage"; id: StageId; status: StageStatus }
  | { type: "resumeStructured"; resume: ResumeDoc }
  | { type: "jobAnalyzed"; analysis: JobAnalysis }
  | { type: "scoredBefore"; scores: Scores }
  | { type: "runSucceeded"; version: Version }
  | { type: "runFailed"; error: ApiError }
  | { type: "runCancelled" }
  | { type: "selectVersion"; id: string }
  | { type: "deleteVersion"; id: string }
  | { type: "toggleChange"; key: string }
  | { type: "setChanges"; keys: string[]; reject: boolean }
  | { type: "setCoverLetter"; versionId: string; text: string }
  | { type: "showView"; view: WorkspaceState["view"] }
  | { type: "reset" };

/** Inputs changed: anything derived from the old inputs is stale. */
const clearDerived = (state: WorkspaceState): WorkspaceState => ({
  ...state,
  original: null,
  analysis: null,
  scoresBefore: null,
  versions: [],
  activeVersionId: null,
  sessionId: null,
  view: "inputs",
});

const updateVersion = (
  state: WorkspaceState,
  id: string,
  update: (v: Version) => Version,
): WorkspaceState => ({
  ...state,
  versions: state.versions.map((v) => (v.id === id ? update(v) : v)),
});

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.state };
    case "setJobDescription": {
      const next = { ...state, jobDescription: action.value };
      // Analysis belongs to the old text; versions survive until the next run.
      return { ...next, analysis: null, scoresBefore: null };
    }
    case "setFile":
      return clearDerived({ ...state, file: action.file });
    case "setOptions":
      return { ...state, options: { ...state.options, ...action.options } };
    case "runStarted": {
      // Cached inputs are cleared whenever their source changed, so a missing
      // cache means the job or resume is new and old versions no longer apply.
      const inputsChanged = !state.original || !state.analysis;
      const stages = idleStages();
      if (state.original) stages.reading = "done";
      if (state.analysis) stages.analyzing = "done";
      const base = inputsChanged
        ? { ...state, versions: [], activeVersionId: null, scoresBefore: null, sessionId: null }
        : state;
      return { ...base, run: { status: "running", stages, error: null } };
    }
    case "stage":
      return {
        ...state,
        run: {
          ...state.run,
          stages: { ...state.run.stages, [action.id]: action.status },
        },
      };
    case "resumeStructured":
      return { ...state, original: action.resume };
    case "jobAnalyzed":
      return { ...state, analysis: action.analysis };
    case "scoredBefore":
      return { ...state, scoresBefore: action.scores };
    case "runSucceeded": {
      // Keep the newest versions; the oldest drops off past the cap.
      const versions = [...state.versions, action.version].slice(-maxVersions);
      return {
        ...state,
        sessionId: state.sessionId ?? crypto.randomUUID(),
        versions,
        activeVersionId: action.version.id,
        run: { status: "idle", stages: idleStages(), error: null },
        view: "results",
      };
    }
    case "runFailed":
      return {
        ...state,
        run: { ...state.run, status: "error", error: action.error },
      };
    case "runCancelled":
      return {
        ...state,
        run: { status: "idle", stages: idleStages(), error: null },
      };
    case "selectVersion":
      return { ...state, activeVersionId: action.id };
    case "deleteVersion": {
      const versions = state.versions.filter((v) => v.id !== action.id);
      const activeVersionId =
        state.activeVersionId === action.id ? (versions.at(-1)?.id ?? null) : state.activeVersionId;
      return {
        ...state,
        versions,
        activeVersionId,
        view: versions.length ? state.view : "inputs",
      };
    }
    case "toggleChange": {
      if (!state.activeVersionId) return state;
      return updateVersion(state, state.activeVersionId, (v) => ({
        ...v,
        rejected: v.rejected.includes(action.key)
          ? v.rejected.filter((k) => k !== action.key)
          : [...v.rejected, action.key],
      }));
    }
    case "setChanges": {
      if (!state.activeVersionId) return state;
      return updateVersion(state, state.activeVersionId, (v) => ({
        ...v,
        rejected: action.reject
          ? [...new Set([...v.rejected, ...action.keys])]
          : v.rejected.filter((k) => !action.keys.includes(k)),
      }));
    }
    case "setCoverLetter":
      return updateVersion(state, action.versionId, (v) => ({
        ...v,
        coverLetter: action.text,
      }));
    case "showView":
      return { ...state, view: action.view };
    case "reset":
      return initialState;
  }
}

export const activeVersion = (state: WorkspaceState): Version | null =>
  state.versions.find((v) => v.id === state.activeVersionId) ?? null;
