"use client";

import { Toast } from "@base-ui/react/toast";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ToastList } from "@/components/ui/ToastList";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    // reducedMotion="user": Motion animations honour prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <Toast.Provider limit={3} timeout={5000}>
        {/* isolation keeps portaled popups above page content (Base UI requirement). */}
        <div className="isolate flex min-h-dvh flex-col">{children}</div>
        <Toast.Portal>
          <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none">
            <ToastList />
          </Toast.Viewport>
        </Toast.Portal>
      </Toast.Provider>
    </MotionConfig>
  );
}
