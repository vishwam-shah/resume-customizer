export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Your files are processed in memory and never stored unless you save a run to your account.
        </p>
        <p>
          <a
            className="underline underline-offset-4 hover:text-fg"
            href="https://github.com/vishwam-shah/resume-customizer"
          >
            Source on GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
