import { diffWords } from "diff";
import { useMemo } from "react";

/**
 * Word-level diff. Never color alone: insertions are underlined and
 * deletions struck through, and screen readers hear "added"/"removed".
 */
export function DiffText({ before, after }: { before: string; after: string }) {
  const parts = useMemo(() => diffWords(before, after), [before, after]);
  return (
    <>
      {parts.map((part, index) => {
        const key = `${index}-${part.value.length}`;
        if (part.added) {
          return (
            <ins key={key} className="rounded-sm bg-added-bg text-added underline">
              <span className="sr-only">[added: </span>
              {part.value}
              <span className="sr-only">]</span>
            </ins>
          );
        }
        if (part.removed) {
          return (
            <del key={key} className="rounded-sm bg-removed-bg text-removed line-through">
              <span className="sr-only">[removed: </span>
              {part.value}
              <span className="sr-only">]</span>
            </del>
          );
        }
        return <span key={key}>{part.value}</span>;
      })}
    </>
  );
}
