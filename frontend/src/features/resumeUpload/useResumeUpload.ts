"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError, isAbort, parseResume } from "@/lib/api/client";
import type { ParsedFile } from "@/lib/api/types";
import { checkFile } from "@/lib/limits";

type UploadError = { message: string; hint: string };

export function useResumeUpload(onParsed: (file: ParsedFile) => void) {
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [error, setError] = useState<UploadError | null>(null);
  const controller = useRef<AbortController | null>(null);

  const upload = useCallback(
    async (file: File): Promise<boolean> => {
      // Instant feedback for problems we can see without a round trip.
      const problem = checkFile(file);
      if (problem) {
        setError(problem);
        return false;
      }
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      setError(null);
      setUploadingName(file.name);
      try {
        onParsed(await parseResume(file, abort.signal));
        return true;
      } catch (caught) {
        if (isAbort(caught)) return false;
        const apiError = ApiError.fromUnknown(caught);
        setError({ message: apiError.message, hint: apiError.hint });
        return false;
      } finally {
        if (controller.current === abort) {
          controller.current = null;
          setUploadingName(null);
        }
      }
    },
    [onParsed],
  );

  const clearError = useCallback(() => setError(null), []);
  return { upload, uploadingName, error, clearError };
}
