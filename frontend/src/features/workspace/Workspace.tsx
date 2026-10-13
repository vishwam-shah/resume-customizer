"use client";

import { AnimatePresence, motion } from "motion/react";
import { ResultsView } from "../results/ResultsView";
import { ProgressPanel } from "../tailor/ProgressPanel";
import { InputsView } from "./InputsView";
import { useWorkspace, WorkspaceProvider } from "./WorkspaceProvider";

function WorkspaceViews() {
  const { state } = useWorkspace();
  const view =
    state.run.status === "running"
      ? "progress"
      : state.view === "results" && state.versions.length > 0
        ? "results"
        : "inputs";

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        {view === "progress" ? (
          <div className="px-4 py-16 sm:py-24">
            <ProgressPanel />
          </div>
        ) : view === "results" ? (
          <ResultsView />
        ) : (
          <InputsView />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function Workspace() {
  return (
    <WorkspaceProvider>
      <WorkspaceViews />
    </WorkspaceProvider>
  );
}
