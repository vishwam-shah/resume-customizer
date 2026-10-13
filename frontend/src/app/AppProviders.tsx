"use client";

import { Toast } from "@base-ui/react/toast";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { ToastList } from "@/components/ui/ToastList";
import { PwaProvider } from "@/features/pwa/usePwa";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    // reducedMotion="user": Motion animations honour prefers-reduced-motion.
    <MotionConfig reducedMotion="user">
      <Toast.Provider limit={3} timeout={5000}>
        {/* isolation keeps portaled popups above page content (Base UI requirement). */}
        <PwaProvider>
          {/* pb: room for the mobile tab bar (3.5rem + home indicator). */}
          <div className="isolate flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </div>
        </PwaProvider>
        <Toast.Portal>
          <Toast.Viewport className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 md:bottom-4 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none">
            <ToastList />
          </Toast.Viewport>
        </Toast.Portal>
      </Toast.Provider>
    </MotionConfig>
  );
}
