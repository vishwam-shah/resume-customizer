from app.features.latex.apply import apply_tailoring
from app.features.latex.convert import escape, latex_to_text
from tests.factories import make_resume

preamble = r"""\documentclass[letterpaper,11pt]{article}
\usepackage{titlesec}
\newcommand{\resumeItem}[1]{\item\small{{#1 \vspace{-2pt}}}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}
"""

source = (
    preamble
    + r"""\begin{document}
\textbf{\Huge Asha Patel} \ \href{mailto:asha@example.com}{asha@example.com} $|$ \href{https://github.com/asha}{GitHub}
\section{Summary}
\small{Software engineer who builds web apps.}
\section{Skills}
\textbf{Languages}{: Python, TypeScript} \
\textbf{Data}{: Pinecone, PostgreSQL}
\section{Experience}
\textbf{Software Engineer} -- Acme \hfill 2023 -- Present
\resumeItemListStart
  \resumeItem{Built a FastAPI service handling 2000 requests per minute}
  \resumeItem{Added semantic search with Pinecone for 40\% faster lookups}
\resumeItemListEnd
\section{Projects}
\textbf{Chat app}
\begin{itemize}
  \item Created a React chat app
\end{itemize}
% \resumeItem{A commented-out bullet that must never change}
\end{document}
"""
)


def test_latex_to_text_keeps_content_and_links():
    text = latex_to_text(source)
    assert "Built a FastAPI service handling 2000 requests per minute" in text
    assert "40% faster lookups" in text
    assert "https://github.com/asha" in text
    assert "commented-out" not in text
    assert "usepackage" not in text


def test_escape_handles_specials():
    assert escape("R&D 50% $5 C#_x {y}") == r"R\&D 50\% \$5 C\#\_x \{y\}"


def test_apply_rewrites_text_in_place_and_keeps_layout():
    original = make_resume()
    tailored = original.model_copy(deep=True)
    tailored.summary = "Backend engineer who ships Python APIs & search."
    tailored.experience[0].bullets = [
        "Added semantic search with Pinecone, making lookups 40% faster",
        "Built a FastAPI service handling 2000 requests per minute for internal tools",
    ]
    tailored.projects[0].bullets = ["Built a React chat app with real-time messaging"]
    tailored.skills[0].items = ["TypeScript", "Python"]

    report = apply_tailoring(source, original, tailored)
    out = report.source

    assert out.startswith(preamble)  # preamble and macros byte-identical
    assert report.bullets_updated == 3 and report.summary_updated and report.skills_updated == 1
    assert not report.unmatched
    # Tailored order is written into the list; specials are escaped.
    first = out.index(r"making lookups 40\% faster")
    second = out.index("for internal tools")
    assert first < second
    assert r"\small{Backend engineer who ships Python APIs \& search.}" in out
    assert r"\textbf{Languages}{: TypeScript, Python}" in out
    assert r"\item Built a React chat app with real-time messaging" in out
    assert r"% \resumeItem{A commented-out bullet that must never change}" in out
    assert out.count("{") == out.count("}")  # still balanced


def test_unchanged_resume_round_trips_exactly():
    original = make_resume()
    assert apply_tailoring(source, original, original).source == source


def test_macro_arguments_and_tables_convert_cleanly():
    tex = r"""\newcommand{\sub}[2]{\item
  \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & \textit{\small#2} \
  \end{tabular*}}
\begin{document}
\begin{center}
    {\Huge \scshape Asha Patel}
\end{center}
\sub{Acme}{Masters of Technology}
\end{document}"""
    text = latex_to_text(tex)
    assert "Asha Patel" in text  # a group after \begin{center} is content
    assert "Masters of Technology" in text  # \small#2 must not fuse into \smallMasters
    assert "Acme | Masters" in text.replace("\n", " ").replace("  ", " ") or "Acme |" in text
    assert "l@" not in text and "extracolsep" not in text


def test_skills_on_the_line_after_the_group_name():
    tex = r"""\begin{document}
\section{Skills}
\begin{tabular}{@{}p{0.3\textwidth} p{0.6\textwidth}@{}}
\textbf{Languages}
& Python, TypeScript \\[2pt]

\textbf{Data}
& Pinecone, PostgreSQL \\
\end{tabular}
\end{document}
"""
    original = make_resume()
    tailored = original.model_copy(deep=True)
    tailored.skills[0].items = ["TypeScript", "Python"]
    report = apply_tailoring(tex, original, tailored)
    assert report.skills_updated == 1 and not report.unmatched
    assert r"& TypeScript, Python \\[2pt]" in report.source
    assert "& Pinecone, PostgreSQL" in report.source


def test_summary_section_is_inserted_when_template_has_none():
    original = make_resume()
    original.summary = None
    tailored = original.model_copy(deep=True)
    tailored.summary = "Backend engineer who ships Python APIs."
    no_summary = source.replace(
        "\section{Summary}\n\small{Software engineer who builds web apps.}\n", ""
    )
    report = apply_tailoring(no_summary, original, tailored)
    assert report.summary_updated and not any("summary" in u for u in report.unmatched)
    out = report.source
    assert out.index(r"\section{Summary}") < out.index(r"\section{Skills}")
    assert "Backend engineer who ships Python APIs." in out


def test_compile_endpoint_refuses_file_access_without_running_tex():
    from fastapi.testclient import TestClient

    from app.main import app

    r = TestClient(app).post(
        "/api/v1/latex/compile", json={"source": r"\input{/proc/self/environ}"}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "unsafeLatex"


def test_trimmed_bullets_are_removed_from_the_template():
    original = make_resume()
    tailored = original.model_copy(deep=True)
    tailored.experience[0].bullets = [original.experience[0].bullets[1]]  # keep one, trimmed
    out = apply_tailoring(source, original, tailored).source
    assert "Built a FastAPI service" not in out  # the whole \resumeItem line is gone
    assert r"\resumeItem{Added semantic search with Pinecone for 40\% faster lookups}" in out
    assert out.count("{") == out.count("}")


def test_compile_error_message_ignores_system_noise():
    from app.features.latex.compile import _first_error

    log = (
        "Fontconfig error: Cannot load default config file: No such file: (null)\n"
        "error: resume.tex:42: Undefined control sequence\n"
    )
    assert _first_error(log) == "line 42: Undefined control sequence"
