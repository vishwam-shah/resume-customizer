from app.features.job.models import JobAnalysis
from app.features.tailor.models import TailorOutput
from app.llm.strict_schema import strict_schema


def _objects(node):
    if isinstance(node, dict):
        if node.get("type") == "object":
            yield node
        for value in node.values():
            yield from _objects(value)
    elif isinstance(node, list):
        for item in node:
            yield from _objects(item)


def test_property_named_title_survives():
    # Regression: the `title` keyword is dropped, but a field called "title" is data.
    schema = strict_schema(JobAnalysis)
    assert "title" in schema["properties"]
    assert "title" in schema["required"]


def test_every_object_is_strict():
    schema = strict_schema(TailorOutput)
    assert "$defs" not in schema
    for obj in _objects(schema):
        assert obj["additionalProperties"] is False
        assert set(obj["required"]) == set(obj["properties"])


def test_nullable_fields_become_type_lists():
    schema = strict_schema(JobAnalysis)
    assert schema["properties"]["company"]["type"] == ["string", "null"]


def test_aliases_are_camel_case():
    assert "mustHaveSkills" in strict_schema(JobAnalysis)["properties"]
