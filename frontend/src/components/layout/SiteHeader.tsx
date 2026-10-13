import Link from "next/link";
import { ThemeMenu } from "./ThemeMenu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 rounded-md font-semibold tracking-tight"
        >
          <LogoMark />
          <span>Tailor</span>
          <span className="sr-only">, resume customizer home</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <ThemeMenu />
        </nav>
      </div>
    </header>
  );
}

/** A needle-and-thread "T": the one bespoke mark in an otherwise plain UI. */
function LogoMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-7" fill="none">
      <rect width="24" height="24" rx="6" className="fill-fg" />
      <path d="M7 7.5h10M12 7.5v9.5" className="stroke-bg" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M14.5 17c1.5-.2 2.5-1 2.5-2.2"
        className="stroke-bg"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
