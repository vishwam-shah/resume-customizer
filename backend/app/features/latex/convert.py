"""LaTeX resume source to readable text, and plain text back to safe LaTeX.

Adapted from the job-apply-agent converter. It keeps \\href URLs (profile links
matter on a resume) and turns \\item into bullets, so the structurer sees the
same shape it would get from a PDF.
"""

from __future__ import annotations

import re

_comment = re.compile(r"(?<!\\)%.*")
_def = re.compile(
    r"\\(?:new|renew|provide)command\*?\s*\{?\\([A-Za-z]+)\}?\s*(?:\[(\d+)\])?\s*(?=\{)"
)
# Commands whose arguments are layout, not text: drop them with their arguments.
_layout = re.compile(
    r"\\(vspace|hspace|setlength|addtolength|pagestyle|thispagestyle|color|fontsize|"
    r"titlerule|rule|faIcon|fa[A-Z][A-Za-z]*)\*?(\[[^\]]*\])?(\{[^{}]*\})*"
)
# Switches with no text argument (often written as \small{...}): drop only the
# command so the text inside the braces survives.
_switch = re.compile(
    r"\\(scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge|"
    r"raggedright|raggedleft|raggedbottom|centering|hfill|vfill|newpage|clearpage|"
    r"columnbreak|noindent|bfseries|itshape|scshape|selectfont|hrule)(?![A-Za-z])\*?"
)


def read_braced(text: str, start: int) -> tuple[str, int]:
    """Return (content, index after the closing brace) for the group at `start`."""
    if start >= len(text) or text[start] != "{":
        return "", start
    depth = 0
    for i in range(start, len(text)):
        char = text[i]
        if char == "\\":
            continue
        if char == "{" and (i == 0 or text[i - 1] != "\\"):
            depth += 1
        elif char == "}" and text[i - 1] != "\\":
            depth -= 1
            if depth == 0:
                return text[start + 1 : i], i + 1
    return text[start + 1 :], len(text)


def _macros(tex: str) -> dict[str, tuple[int, str]]:
    """User macros: name -> (argument count, body)."""
    found: dict[str, tuple[int, str]] = {}
    for match in _def.finditer(tex):
        body, _ = read_braced(tex, match.end())
        found[match.group(1)] = (int(match.group(2) or 0), body)
    return found


def _expand_macros(text: str, macros: dict[str, tuple[int, str]]) -> str:
    for _ in range(3):  # nested macros
        changed = False
        for name, (argc, body) in macros.items():
            pattern = re.compile(rf"\\{name}(?![A-Za-z])")
            out, pos = [], 0
            for match in pattern.finditer(text):
                if match.start() < pos:
                    continue
                args, cursor = [], match.end()
                for _ in range(argc):
                    while cursor < len(text) and text[cursor] in " \t\n":
                        cursor += 1
                    arg, cursor = read_braced(text, cursor)
                    args.append(arg)
                # TeX tokenizes before substituting, so "\small#3" is \small then
                # the argument; keep a space so it can't fuse into \smallMasters.
                expanded = re.sub(r"(\\[A-Za-z]+)(#\d)", r"\1 \2", body)
                for i, arg in enumerate(args, 1):
                    expanded = expanded.replace(f"#{i}", arg)
                out += [text[pos : match.start()], expanded]
                pos = cursor
                changed = True
            text = "".join(out) + text[pos:]
        if not changed:
            break
    return text


def body_of(tex: str) -> str:
    start = tex.find(r"\begin{document}")
    if start != -1:
        tex = tex[start + len(r"\begin{document}") :]
    end = tex.find(r"\end{document}")
    return tex[:end] if end != -1 else tex


def latex_to_text(tex: str) -> str:
    """Readable text of a LaTeX resume, close to what an ATS would extract."""
    text = _comment.sub("", tex or "")
    macros = _macros(text)
    text = _expand_macros(body_of(text), macros)

    text = re.sub(r"\\item\b\s*(\[[^\]]*\])?", "\n- ", text)
    text = re.sub(r"\\\\(\[[^\]]*\])?", "\n", text)
    text = re.sub(r"\\(?:sub)*section\*?\s*\{([^{}]*)\}", r"\n\n\1\n", text)
    # \begin{env} plus arguments written directly after it, in any order and up to
    # two brace levels deep, e.g. tabular*'s {width}[t]{l@{\extracolsep{\fill}}r}.
    # No whitespace allowed: a {...} group on the next line is content, not an argument.
    text = re.sub(
        r"\\begin\{[^}]*\}(\[[^\]]*\]|\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})*",
        "\n",
        text,
    )
    # A bare & is a table column separator, not text.
    text = re.sub(r"(?<!\\)&", " | ", text)
    text = re.sub(r"\\end\{[^}]*\}", "\n", text)
    text = _layout.sub(" ", text)
    text = _switch.sub(" ", text)
    # \href{url}{label}: keep both, so profile links survive.
    text = re.sub(
        r"\\href\s*\{([^{}]*)\}\s*\{([^{}]*)\}",
        lambda m: (
            m.group(2)
            if m.group(1).replace("mailto:", "") in m.group(2)
            else f"{m.group(2)} ({m.group(1).replace('mailto:', '')})"
        ),
        text,
    )
    text = re.sub(r"\\url\s*\{([^{}]*)\}", r"\1", text)
    text = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?", " ", text)
    text = unescape(text)
    text = re.sub(r"[{}]", " ", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def unescape(text: str) -> str:
    text = text.replace("~", " ").replace("--", "-")
    for raw in "&%$#_":
        text = text.replace("\\" + raw, raw)
    return text.replace("$", "")


_escapes = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def escape(text: str) -> str:
    """Plain text to LaTeX that compiles: every special character escaped."""
    return "".join(_escapes.get(char, char) for char in text)
