"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { AppToaster } from "@/components/ui/AppToaster";
import { PwaProvider } from "@/features/pwa/usePwa";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    // reducedMotion="user": Motion animations honour prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <PwaProvider>
        {/* isolation keeps portaled popups above page content (Base UI requirement);
            pb leaves room for the mobile tab bar (3.5rem + home indicator). */}
        <div className="isolate flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
      </PwaProvider>
      <AppToaster />
    </MotionConfig>
  );
}
