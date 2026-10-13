/**
 * Friendly names for the API types generated from backend/openapi.json.
 * Regenerate with `pnpm api:types` after changing backend models.
 */
import type { components } from "./schema";

type Schemas = components["schemas"];

export type ResumeDoc = Schemas["ResumeDoc"];
export type ExperienceItem = Schemas["ExperienceItem"];
export type ProjectItem = Schemas["ProjectItem"];
export type SkillGroup = Schemas["SkillGroup"];
export type ParsedFile = Schemas["ParsedFile"];
export type JobAnalysis = Schemas["JobAnalysis"];
export type Scores = Schemas["Scores"];
export type MatchScore = Schemas["MatchScore"];
export type AtsScore = Schemas["AtsScore"];
export type ScoreComponent = Schemas["ScoreComponent"];
export type TailorRequest = Schemas["TailorRequest"];
export type TailorResult = Schemas["TailorResult"];
export type KeywordSuggestion = Schemas["KeywordSuggestion"];
export type Flag = Schemas["Flag"];
export type StageEvent = Schemas["StageEvent"];
export type StageId = StageEvent["id"];
export type DoneEvent = Schemas["DoneEvent"];
export type ErrorBody = Schemas["ErrorBody"];
export type Meta = Schemas["Meta"];
export type ExportRequest = Schemas["ExportRequest"];
export type CoverLetterRequest = Schemas["CoverLetterRequest"];

export type Section = NonNullable<TailorRequest["sections"]>[number];
export type Tone = NonNullable<TailorRequest["tone"]>;
export type ExportFormat = ExportRequest["format"];
export type LetterLength = NonNullable<CoverLetterRequest["length"]>;
export type LatexApplyResult = Schemas["LatexApplyResult"];
