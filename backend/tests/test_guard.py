from app.features.tailor.guard import apply_output, clean_dashes
from app.features.tailor.models import TailoredEntry, TailorOutput, TermEvidence
from tests.factories import make_job, make_resume

all_sections = ["summary", "skills", "experience", "projects"]


def _output(**overrides) -> TailorOutput:
    base = dict(
        summary="",
        skills=[],
        experience=[],
        projects=[],
        term_evidence=[],
        keyword_suggestions=[],
        change_notes=[],
    )
    return TailorOutput(**(base | overrides))


def test_invented_number_reverts_bullet_and_flags():
    original = make_resume()
    out = _output(
        experience=[
            TailoredEntry(
                id="exp-1",
                bullets=[
                    "Built a FastAPI service handling 9000 requests per minute",
                    "Added semantic search with Pinecone for 40% faster lookups",
                ],
            )
        ]
    )
    doc, _, flags = apply_output(original, out, make_job(), all_sections)
    assert doc.experience[0].bullets[0] == original.experience[0].bullets[0]
    assert flags and flags[0].item_id == "exp-1"


def test_unproven_job_skill_in_bullet_is_reverted():
    out = _output(
        experience=[
            TailoredEntry(
                id="exp-1",
                bullets=[
                    "Built a FastAPI service on Kubernetes handling 2000 requests per minute",
                    "Added semantic search with Pinecone for 40% faster lookups",
                ],
            )
        ]
    )
    doc, _, flags = apply_output(make_resume(), out, make_job(), all_sections)
    assert "Kubernetes" not in doc.experience[0].bullets[0]
    assert flags


def test_umbrella_term_with_real_evidence_is_kept():
    bullet = "Added semantic search over vector databases (Pinecone) for 40% faster lookups"
    out = _output(
        experience=[
            TailoredEntry(
                id="exp-1",
                bullets=[bullet, "Built a FastAPI service handling 2000 requests per minute"],
            )
        ],
        term_evidence=[TermEvidence(term="vector databases", evidence=["Pinecone"])],
    )
    doc, _, flags = apply_output(make_resume(), out, make_job(), all_sections)
    assert doc.experience[0].bullets[0] == bullet
    assert not flags


def test_umbrella_term_with_fake_evidence_is_reverted():
    out = _output(
        experience=[
            TailoredEntry(
                id="exp-1",
                bullets=[
                    "Added semantic search over vector databases for 40% faster lookups",
                    "Built a FastAPI service handling 2000 requests per minute",
                ],
            )
        ],
        term_evidence=[TermEvidence(term="vector databases", evidence=["Weaviate"])],
    )
    doc, _, _ = apply_output(make_resume(), out, make_job(), all_sections)
    assert "vector databases" not in doc.experience[0].bullets[0]


def test_dropped_bullets_are_restored():
    out = _output(
        experience=[
            TailoredEntry(
                id="exp-1", bullets=["Built a FastAPI service handling 2000 requests per minute"]
            )
        ]
    )
    doc, _, _ = apply_output(make_resume(), out, make_job(), all_sections)
    assert len(doc.experience[0].bullets) == 2


def test_unshown_skill_moves_to_suggestions():
    from app.features.resume.models import SkillGroup

    out = _output(skills=[SkillGroup(name="Languages", items=["Python", "Kubernetes"])])
    doc, suggestions, flags = apply_output(make_resume(), out, make_job(), all_sections)
    assert doc.skills[0].items == ["Python"]
    assert any(s.keyword == "Kubernetes" for s in suggestions)
    assert any(f.section == "skills" for f in flags)


def test_unrequested_sections_are_untouched():
    original = make_resume()
    out = _output(summary="Totally new summary.")
    doc, _, _ = apply_output(original, out, make_job(), ["skills"])
    assert doc.summary == original.summary


def test_clean_dashes():
    assert clean_dashes("Led a team \u2014 shipped fast") == "Led a team, shipped fast"
    assert clean_dashes("2021\u20132023") == "2021-2023"


def test_revert_after_reorder_never_duplicates_bullets():
    # Regression: the rewritten list is reordered and its second bullet is
    # reverted; it must revert to its own source, not a bullet already used.
    original = make_resume()
    first, second = original.experience[0].bullets
    out = _output(
        experience=[
            TailoredEntry(
                id="exp-1",
                bullets=[second, "Built a FastAPI service handling 9000 requests per minute"],
            )
        ]
    )
    doc, _, _ = apply_output(original, out, make_job(), all_sections)
    assert doc.experience[0].bullets == [second, first]


def test_duplicate_bullets_from_model_are_collapsed():
    original = make_resume()
    first, second = original.experience[0].bullets
    out = _output(experience=[TailoredEntry(id="exp-1", bullets=[first, first])])
    doc, _, _ = apply_output(original, out, make_job(), all_sections)
    assert sorted(doc.experience[0].bullets) == sorted([first, second])


def test_rewrite_that_drops_a_metric_is_reverted():
    original = make_resume()
    first, second = original.experience[0].bullets
    out = _output(
        experience=[
            TailoredEntry(
                id="exp-1",
                bullets=["Built a high-throughput FastAPI service", second],
            )
        ]
    )
    doc, _, flags = apply_output(original, out, make_job(), all_sections)
    assert doc.experience[0].bullets[0] == first  # "2000 requests per minute" kept
    assert any("dropped a number" in f.message for f in flags)
