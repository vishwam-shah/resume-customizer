"use client";

import { useEffect, useState } from "react";

/** Seconds left before an action (like "Resend code") is allowed again. */
export function useCooldown(initialSeconds = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [seconds]);
  return { seconds, start: (value = 60) => setSeconds(value) };
}
