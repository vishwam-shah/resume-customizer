"""Turn a Pydantic model into a JSON schema strict structured-output modes accept.

Strict modes (Groq `strict: true`, OpenAI) require: every object lists all of
its properties in `required`, sets `additionalProperties: false`, and optional
values are expressed as nullable types. Some providers also reject `$ref`, so
definitions are inlined. Titles and defaults are dropped as noise.
"""

from __future__ import annotations

import copy
from typing import Any

from pydantic import BaseModel

_dropped_keys = {"title", "default", "examples"}


def _resolve(node: Any, defs: dict[str, Any]) -> Any:
    if isinstance(node, list):
        return [_resolve(n, defs) for n in node]
    if not isinstance(node, dict):
        return node

    if "$ref" in node:
        name = node["$ref"].rsplit("/", 1)[-1]
        return _resolve(copy.deepcopy(defs[name]), defs)

    # `X | None` arrives as anyOf[{type: X}, {type: null}]; flatten simple
    # cases to `type: [X, "null"]`, which every strict mode understands.
    any_of = node.get("anyOf")
    if any_of and all(isinstance(o, dict) and set(o) <= {"type"} for o in any_of):
        node = {k: v for k, v in node.items() if k != "anyOf"}
        node["type"] = [o["type"] for o in any_of]

    out: dict[str, Any] = {}
    for key, value in node.items():
        if key == "properties":
            # Property names are data, not schema keywords: a field called
            # "title" must survive even though the `title` keyword is dropped.
            out[key] = {name: _resolve(sub, defs) for name, sub in value.items()}
        elif key not in _dropped_keys and key != "$defs":
            out[key] = _resolve(value, defs)
    if out.get("type") == "object" and "properties" in out:
        out["required"] = list(out["properties"].keys())
        out["additionalProperties"] = False
    return out


def strict_schema(model: type[BaseModel]) -> dict[str, Any]:
    raw = model.model_json_schema(by_alias=True)
    return _resolve(raw, raw.get("$defs", {}))
