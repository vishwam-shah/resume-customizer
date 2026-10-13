"""Base model for everything that crosses the API boundary.

Python code keeps snake_case attributes; JSON on the wire (and the schemas
handed to the LLM) uses camelCase, matching the TypeScript frontend.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        validate_by_name=True,
        validate_by_alias=True,
    )
