"""Compile a LaTeX resume to PDF with Tectonic, safely.

Tectonic is a self-contained XeLaTeX engine that fetches only the packages a
document uses (the Docker image pre-caches the common resume ones).

The source is untrusted (users paste it), so compilation is locked down:
- `--untrusted` disables Tectonic's known-insecure features (no shell escape);
- the process gets an empty environment, so even a file read can't reach the
  API keys (e.g. via /proc/self/environ), and runs in a throwaway directory;
- commands that read or write arbitrary files are refused before compiling;
- a hard timeout and an output size cap.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.core.errors import AppError

timeout_seconds = 60
max_pdf_bytes = 5 * 1024 * 1024

# pdfTeX-only lines that XeTeX rejects; XeTeX already writes Unicode-searchable
# PDFs. Removed for compiling only: the user's .tex keeps them for pdfLaTeX.
_pdftex_only = re.compile(
    r"^[ \t]*(\\input\{glyphtounicode\}|\\pdfgentounicode\s*=\s*1)[ \t]*$", re.M
)

# File access a resume never needs. Relative \input of a bundled package is fine;
# absolute paths, parent directories and raw file streams are not.
_forbidden = re.compile(
    r"\\(?:input|include|includegraphics|InputIfFileExists|lstinputlisting|verbatiminput)"
    r"\s*(?:\[[^\]]*\])?\s*\{\s*(?:/|~|[A-Za-z]:|\.\.)"
    r"|\\(?:openin|openout|immediate\s*\\write|write18|directlua|catcode)"
    r"|/proc/|/etc/|\\usepackage(?:\[[^\]]*\])?\{[^}]*(?:shellesc|bashful|minted)[^}]*\}"
)


@dataclass
class CompileResult:
    pdf: bytes
    pages: int


def engine() -> str | None:
    return shutil.which("tectonic") or os.environ.get("TECTONIC_PATH")


def prepare(source: str) -> str:
    if _forbidden.search(source):
        raise AppError(
            "unsafeLatex",
            "This LaTeX reads or writes files outside the document, which we don't run.",
            hint="Remove \\input/\\include of absolute paths and any \\write18, \\openin or "
            "\\openout, then try again.",
            status=422,
        )
    return _pdftex_only.sub(lambda m: f"% {m.group(1)}  (pdfTeX only; skipped by XeTeX)", source)


# System chatter that isn't about the document (e.g. a missing fontconfig file).
_noise = re.compile(r"^(Fontconfig (?:error|warning)|warning:|note:)", re.I)


def _first_error(output: str) -> str:
    """The first LaTeX error with its line, e.g. 'line 42: Undefined control sequence'."""
    output = "\n".join(line for line in output.splitlines() if not _noise.match(line.strip()))
    for line in output.splitlines():
        match = re.match(r"error: (?:[^:]+\.tex:)?(\d+): (.+)", line.strip())
        if match:
            return f"line {match.group(1)}: {match.group(2)}"
    for line in output.splitlines():
        if line.strip().startswith(("error:", "!")):
            return line.strip().removeprefix("error:").strip()
    return "the LaTeX engine stopped without a specific message"


def compile_latex(source: str) -> CompileResult:
    prepared = prepare(source)  # refuse unsafe input before anything else
    exe = engine()
    if not exe:
        raise AppError(
            "latexUnavailable",
            "LaTeX compiling isn't available on this server.",
            hint="Download the .tex and compile it in Overleaf instead.",
            status=503,
        )
    with tempfile.TemporaryDirectory(prefix="tex-") as workdir:
        tex = Path(workdir) / "resume.tex"
        tex.write_text(prepared, encoding="utf-8")
        # Minimal environment: no secrets; HOME/cache so the package cache is reused.
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": os.environ.get("TECTONIC_HOME", workdir),
            "XDG_CACHE_HOME": os.environ.get("TECTONIC_CACHE", str(Path(workdir) / ".cache")),
        }
        if os.name == "nt":  # local development on Windows
            env.update(
                {k: os.environ[k] for k in ("SYSTEMROOT", "LOCALAPPDATA") if k in os.environ}
            )
        try:
            run = subprocess.run(
                [exe, "-X", "compile", "--untrusted", str(tex)],
                cwd=workdir,
                env=env,
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as e:
            raise AppError(
                "latexTimeout",
                "Compiling took too long and was stopped.",
                hint="Simplify the document, or compile it in Overleaf.",
                status=422,
            ) from e
        pdf_path = tex.with_suffix(".pdf")
        if run.returncode != 0 or not pdf_path.exists():
            raise AppError(
                "latexError",
                f"Your LaTeX didn't compile: {_first_error(run.stderr + run.stdout)}.",
                hint="Fix that line in the editor below, or reset to the tailored version.",
                status=422,
            )
        pdf = pdf_path.read_bytes()
    if len(pdf) > max_pdf_bytes:
        raise AppError("latexTooLarge", "The compiled PDF is unusually large.", status=422)
    import pymupdf

    with pymupdf.open(stream=pdf, filetype="pdf") as document:
        pages = document.page_count
    return CompileResult(pdf=pdf, pages=pages)
