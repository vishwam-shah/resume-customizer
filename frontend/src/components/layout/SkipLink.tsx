export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-fg focus:px-4 focus:py-3 focus:font-medium focus:text-inverse-fg"
    >
      Skip to main content
    </a>
  );
}
